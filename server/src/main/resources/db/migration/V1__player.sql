CREATE TABLE player (
    id            uuid PRIMARY KEY,
    email         varchar(254) NOT NULL UNIQUE,
    password_hash varchar(100),
    google_sub    varchar(255) UNIQUE,
    display_name  varchar(40)  NOT NULL,
    fossils       integer      NOT NULL DEFAULT 0 CHECK (fossils >= 0),
    runs          integer      NOT NULL DEFAULT 0,
    wins          integer      NOT NULL DEFAULT 0,
    endless_runs  integer      NOT NULL DEFAULT 0,
    best_time     double precision NOT NULL DEFAULT 0,
    best_era      integer      NOT NULL DEFAULT 0,
    last_dino     varchar(20),
    seen_patch    varchar(20),
    imported_at   timestamptz,
    version       bigint       NOT NULL DEFAULT 0,
    created_at    timestamptz  NOT NULL,
    updated_at    timestamptz  NOT NULL
);

CREATE TABLE dino_progress (
    player_id            uuid        NOT NULL REFERENCES player (id) ON DELETE CASCADE,
    dino                 varchar(20) NOT NULL CHECK (dino IN ('trex', 'raptor', 'triceratops')),
    mastery_xp           integer     NOT NULL DEFAULT 0,
    cleared_index        integer     NOT NULL DEFAULT -1,
    preferred_difficulty varchar(20) CHECK (preferred_difficulty IN ('filhote', 'normal', 'predador', 'extincao')),
    best_time            double precision NOT NULL DEFAULT 0,
    best_era             integer     NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, dino)
);

CREATE TABLE shop_level (
    player_id uuid        NOT NULL REFERENCES player (id) ON DELETE CASCADE,
    dino      varchar(20) NOT NULL CHECK (dino IN ('trex', 'raptor', 'triceratops')),
    item_id   varchar(40) NOT NULL,
    level     integer     NOT NULL CHECK (level >= 0),
    PRIMARY KEY (player_id, dino, item_id)
);
