CREATE TABLE run (
    id                   uuid PRIMARY KEY,
    player_id            uuid        NOT NULL REFERENCES player (id) ON DELETE CASCADE,
    dino                 varchar(20) NOT NULL CHECK (dino IN ('trex', 'raptor', 'triceratops')),
    difficulty           varchar(20) NOT NULL CHECK (difficulty IN ('filhote', 'normal', 'predador', 'extincao')),
    victory              boolean     NOT NULL,
    elite_killed         boolean     NOT NULL,
    boss_killed          boolean     NOT NULL,
    endless              boolean     NOT NULL,
    elapsed_time         double precision NOT NULL,
    endless_time         double precision NOT NULL,
    kills                integer     NOT NULL,
    level                integer     NOT NULL,
    era                  integer     NOT NULL,
    damage_dealt         double precision NOT NULL,
    damage_taken         double precision NOT NULL,
    upgrades             jsonb       NOT NULL,
    fossils_earned       integer     NOT NULL,
    first_win_bonus      integer     NOT NULL DEFAULT 0,
    unlocked_difficulty  varchar(20),
    mastery_xp_earned    integer     NOT NULL,
    mastery_level_before integer     NOT NULL,
    mastery_level_after  integer     NOT NULL,
    created_at           timestamptz NOT NULL
);

CREATE INDEX run_player_created_idx ON run (player_id, created_at DESC);
