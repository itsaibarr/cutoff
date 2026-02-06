# Supabase SQL Reference

These SQL files are for setting up and troubleshooting your Supabase project.

## Files

| File | Purpose |
|------|---------|
| `supabase-schema.sql` | Main database schema - run this first |
| `fix_permissions.sql` | RLS policy fixes if sync fails |
| `pairing_function.sql` | Secure pairing code verification |

## Setup

1. Create a new Supabase project
2. Go to **SQL Editor**
3. Run `supabase-schema.sql` to create tables
4. If using pairing, run `pairing_function.sql`

## Troubleshooting

If sync fails with permission errors, run `fix_permissions.sql` to reset RLS policies.
