-- The display name is public (shown on the ranking). Accounts created before this fix may carry
-- the e-mail local part as their name; replace it with a random "Jogador-XXXX" handle.
UPDATE player
SET display_name = 'Jogador-' || upper(substr(md5(id::text), 1, 4))
WHERE google_sub IS NOT NULL
  AND display_name = split_part(email, '@', 1);
