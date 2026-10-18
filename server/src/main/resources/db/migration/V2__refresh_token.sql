CREATE TABLE refresh_token (
    id         uuid PRIMARY KEY,
    player_id  uuid        NOT NULL REFERENCES player (id) ON DELETE CASCADE,
    token_hash varchar(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL
);

CREATE INDEX refresh_token_player_idx ON refresh_token (player_id);
