# Supabase Setup Instructions

## Step 1: Install Dependencies
The Supabase client library has been added to your `package.json`. Run:
```bash
npm install
```

## Step 2: Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project
4. Wait for the project to be set up (takes a few minutes)

## Step 3: Get Your Supabase Credentials
1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy your **Project URL** (this is your `SUPABASE_URL`)
3. Copy your **anon/public key** (this is your `SUPABASE_ANON_KEY`)

## Step 4: Create the Database Table
1. In your Supabase project, go to **SQL Editor**
2. Run the SQL script from `supabase_setup.sql` to create the `bookings` table

## Step 5: Set Up Environment Variables
Create a `.env` file in your project root with the following:
```
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
PORT=8080
```

Replace `your_supabase_project_url_here` and `your_supabase_anon_key_here` with your actual Supabase credentials.

## Step 6: Test the Integration
Once everything is set up, when a booking is made through Dialogflow, the booking details will be automatically saved to your Supabase `bookings` table.

## Database Schema
The `bookings` table has the following structure:
- `id` - Auto-incrementing primary key
- `email` - Customer email address
- `phone` - Customer phone number
- `arrival` - Arrival location
- `destination` - Destination location
- `date` - Booking date
- `number_of_people` - Number of people
- `created_at` - Timestamp of when the booking was created

