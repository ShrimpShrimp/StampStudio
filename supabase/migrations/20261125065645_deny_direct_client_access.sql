-- Defense in depth if client grants or permissive policies are added later.
-- Normal access remains through the validated Edge Function's service role.
create policy "No direct client access" on public.stamp_contributions
  as restrictive for all to anon, authenticated
  using (false) with check (false);
