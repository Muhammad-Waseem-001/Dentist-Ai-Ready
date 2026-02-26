require("dotenv").config();
const fs = require("fs");
const { WebhookClient } = require("dialogflow-fulfillment");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 8080;
const CLINIC_NAME = process.env.CLINIC_NAME || "Happy Teeth Clinic";
const CLINIC_TIMEZONE = process.env.CLINIC_TIMEZONE || "Asia/Karachi";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || "Sheet1!A:F";
const GOOGLE_SERVICE_ACCOUNT_KEY_FILE =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ||
  path.join(__dirname, "credentials.json");

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.warn(
    "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY to enable DB persistence."
  );
}
if (!GOOGLE_SHEET_ID) {
  console.warn(
    "Google Sheets is not configured. Set GOOGLE_SHEET_ID to enable sheet persistence."
  );
}
if (!smtpUser || !smtpPass) {
  console.warn(
    "SMTP is not configured. Set SMTP_USER and SMTP_PASS to enable confirmation emails."
  );
}

let cachedSheetsClient = null;

function normalizeParam(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value[0] ? String(value[0]).trim() : "";
  if (typeof value === "object") {
    if (value.name) return String(value.name).trim();
    if (value.email) return String(value.email).trim();
    if (value.value) return String(value.value).trim();
    if (value.date_time) return String(value.date_time).trim();
    if (value.startDate) return String(value.startDate).trim();
    return JSON.stringify(value);
  }
  return String(value).trim();
}

function formatDateTime(value) {
  const dateObject = new Date(value);
  if (Number.isNaN(dateObject.getTime())) {
    return String(value);
  }

  return dateObject.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
    timeZone: CLINIC_TIMEZONE,
  });
}

async function getSheetsClient() {
  if (cachedSheetsClient) return cachedSheetsClient;

  const hasEnvCredentials =
    process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY;
  const hasKeyFile = fs.existsSync(GOOGLE_SERVICE_ACCOUNT_KEY_FILE);

  if (!hasEnvCredentials && !hasKeyFile) {
    throw new Error(
      "Google credentials missing. Set GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY or provide GOOGLE_SERVICE_ACCOUNT_KEY_FILE."
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: hasEnvCredentials
      ? {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }
      : undefined,
    keyFile: !hasEnvCredentials ? GOOGLE_SERVICE_ACCOUNT_KEY_FILE : undefined,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  cachedSheetsClient = google.sheets({ version: "v4", auth: client });
  return cachedSheetsClient;
}

async function saveBookingToSupabase(record) {
  if (!supabase) {
    return { ok: false, reason: "supabase_not_configured" };
  }

  const { data, error } = await supabase
    .from("dental_appointments")
    .insert([
      {
        patient_name: record.name,
        email: record.email,
        phone: record.phone,
        appointment_date: record.formattedDate,
        treatment_type: record.treatment,
        created_at: record.formattedNow,
      },
    ])
    .select();

  if (error) {
    throw error;
  }

  return { ok: true, data };
}

async function saveBookingToGoogleSheets(record) {
  if (!GOOGLE_SHEET_ID) {
    return { ok: false, reason: "google_sheet_id_missing" };
  }

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: GOOGLE_SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          record.name,
          record.email,
          record.phone,
          record.formattedDate,
          record.treatment,
          record.formattedNow,
        ],
      ],
    },
  });

  return { ok: true };
}

function getMailerTransporter() {
  if (!smtpUser || !smtpPass) return null;

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
async function webhookHandler(req, res) {
  var id = res.req.body.session.substr(43);
  console.log(id);
  const agent = new WebhookClient({ request: req, response: res });

  function hi(agent) {
    console.log(`intent  =>  hi`);
    agent.add(`🦷 Welcome to [Happy Teeth Clinic]!

Hello! We’re glad to see you here. I’m your virtual assistant and I can help you:

Book a dental appointment 🗓️

Learn about our services 🦷

Get clinic timings & contact info 📞

How may I assist you today? 😊`);
  }

  function fallback(agent) {
    agent.add("Fallback Intent called!");
  }

  async function booking(agent) {
    const rawParams = agent.parameters || {};
    const name = normalizeParam(rawParams.name);
    const email = normalizeParam(rawParams.email);
    const phone = normalizeParam(rawParams.phone);
    const date = normalizeParam(rawParams.date);
    const treatment = normalizeParam(rawParams.treatment);

    if (!name || !email || !phone || !date || !treatment) {
      agent.add(
        "I need your name, email, phone, treatment, and appointment date to complete the booking."
      );
      return;
    }

    const record = {
      name,
      email,
      phone,
      date,
      treatment,
      formattedDate: formatDateTime(date),
      formattedNow: formatDateTime(new Date().toISOString()),
    };

    console.log(`Booking request: ${record.name}, ${record.treatment}, ${record.date}`);

    const [dbResult, sheetResult] = await Promise.allSettled([
      saveBookingToSupabase(record),
      saveBookingToGoogleSheets(record),
    ]);

    if (dbResult.status === "rejected") {
      console.error("Error saving to Supabase:", dbResult.reason);
    } else {
      console.log("Supabase save result:", dbResult.value);
    }

    if (sheetResult.status === "rejected") {
      console.error("Error saving to Google Sheets:", sheetResult.reason);
    } else {
      console.log("Google Sheets save result:", sheetResult.value);
    }

    const isPersisted =
      (dbResult.status === "fulfilled" && dbResult.value.ok) ||
      (sheetResult.status === "fulfilled" && sheetResult.value.ok);

    if (isPersisted) {
      agent.add(
        `Thank you ${record.name}. Your dental appointment for ${record.treatment} on ${record.formattedDate} has been booked.`
      );
    } else {
      agent.add(
        `Hi ${record.name}, there was an issue booking your dental appointment for ${record.treatment} on ${record.formattedDate}. Please contact support.`
      );
    }

    const transporter = getMailerTransporter();
    if (!transporter) {
      return;
    }

    try {
      const info = await transporter.sendMail({
        from: `"${CLINIC_NAME}" <${smtpUser}>`,
        to: record.email,
        subject: "Dental Appointment Confirmed",
        text: `Dear ${record.name},\n\nYour dental appointment for ${record.treatment} on ${record.formattedDate} has been booked.\n\nThank you!`,
      });
      console.log("Confirmation email sent:", info.messageId);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
    }
  }
  let intentMap = new Map();
  intentMap.set("Default Welcome Intent", hi);
  intentMap.set("Default Fallback Intent", fallback);
  intentMap.set("ticket", booking);
  agent.handleRequest(intentMap);
}

app.post("/webhook", webhookHandler);
app.post("/", webhookHandler);

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
  });
}

module.exports = app;
