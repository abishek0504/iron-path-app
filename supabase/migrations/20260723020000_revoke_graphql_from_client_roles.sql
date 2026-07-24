-- Pre-launch hardening: remove the GraphQL surface for client roles.
--
-- The mobile app talks to PostgREST exclusively (supabase-js `.from()` / RPC) and
-- never calls the GraphQL endpoint (`/graphql/v1`). Supabase advisor lint 0027
-- (pg_graphql_authenticated_table_exposed) flags every public table as
-- discoverable in the GraphQL schema because `authenticated` can SELECT it.
--
-- We cannot revoke SELECT on those tables (the app reads them via PostgREST under
-- RLS), so instead we revoke access to the GraphQL schemas themselves. This closes
-- the GraphQL discoverability surface without affecting PostgREST reads, which
-- remain governed by Row-Level Security.
--
-- Reversible: re-grant USAGE/EXECUTE on graphql + graphql_public to restore GraphQL.

revoke usage on schema graphql_public from anon, authenticated;
revoke execute on all functions in schema graphql_public from anon, authenticated;

revoke usage on schema graphql from anon, authenticated;
revoke execute on all functions in schema graphql from anon, authenticated;
