revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function claim_invites(uuid, text), handle_new_user(), cleanup_attribute_values(),
  team_players_same_club() from authenticated;