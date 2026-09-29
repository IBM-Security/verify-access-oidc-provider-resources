-- DPC schema
-- Source of truth: internal/models/*.go
-- No seed data — initialize_resources.go owns all default rows.

-- Required for trigram-based name search on purpose table
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── data_item ─────────────────────────────────────────────────────────────────
-- internal/models/data_item.go: DataItemRecord
CREATE TABLE IF NOT EXISTS data_item (
    dt_tenant     TEXT         NOT NULL,
    dt_id         TEXT         NOT NULL,
    dt_name       TEXT         NOT NULL,
    dt_desc       TEXT         DEFAULT NULL,
    dt_created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dt_updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (dt_tenant, dt_id),
    CONSTRAINT dt_un_1 UNIQUE (dt_tenant, dt_name)
);

CREATE INDEX IF NOT EXISTS idx_data_item_tenant ON data_item(dt_tenant);
CREATE INDEX IF NOT EXISTS idx_data_item_name   ON data_item(dt_tenant, dt_name);

-- ── accesstype ────────────────────────────────────────────────────────────────
-- internal/models/access_type.go: AccessTypeRecord
CREATE TABLE IF NOT EXISTS accesstype (
    at_tenant TEXT NOT NULL,
    at_id     TEXT NOT NULL,
    at_name   TEXT NOT NULL,
    PRIMARY KEY (at_tenant, at_id),
    CONSTRAINT at_un_1 UNIQUE (at_tenant, at_name)
);

CREATE INDEX IF NOT EXISTS idx_accesstype_tenant ON accesstype(at_tenant);
CREATE INDEX IF NOT EXISTS idx_accesstype_name   ON accesstype(at_tenant, at_name);

-- ── policy ────────────────────────────────────────────────────────────────────
-- internal/models/policy.go: PolicyRecord
CREATE TABLE IF NOT EXISTS policy (
    pol_tenant           TEXT        NOT NULL,
    pol_id               TEXT        NOT NULL,
    pol_version          BIGINT      NOT NULL DEFAULT 0,
    pol_rulelist         UUID[]      NOT NULL DEFAULT '{}',
    pol_createdtime      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pol_lastmodifiedtime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (pol_tenant, pol_id)
);

-- ── rule ──────────────────────────────────────────────────────────────────────
-- internal/models/rule.go: RuleRecord
CREATE TABLE IF NOT EXISTS rule (
    rul_tenant           TEXT    NOT NULL,
    rul_id               TEXT    NOT NULL,
    rul_name             TEXT    NOT NULL,
    rul_desc             TEXT    DEFAULT NULL,
    rul_tags             TEXT[]  NOT NULL DEFAULT '{}',
    rul_starttime        BIGINT  NOT NULL,
    rul_endtime          BIGINT  DEFAULT NULL,
    rul_legalcategory    INTEGER DEFAULT NULL,
    rul_assentuidefault  BOOLEAN DEFAULT NULL,
    rul_discloseable     BOOLEAN NOT NULL DEFAULT TRUE,
    rul_decision         TEXT    DEFAULT NULL,
    rul_decisionreason   TEXT    DEFAULT NULL,
    rul_script           TEXT    NOT NULL DEFAULT '',
    rul_createdtime      BIGINT  NOT NULL,
    rul_lastmodifiedtime BIGINT  NOT NULL,
    PRIMARY KEY (rul_tenant, rul_id),
    CONSTRAINT rul_un_1 UNIQUE (rul_tenant, rul_name)
);

CREATE INDEX IF NOT EXISTS idx_rule_tenant ON rule(rul_tenant);
CREATE INDEX IF NOT EXISTS idx_rule_name   ON rule(rul_tenant, rul_name);

-- ── rulecondition ─────────────────────────────────────────────────────────────
-- internal/models/rule.go: RuleConditionRecord
CREATE TABLE IF NOT EXISTS rulecondition (
    rulc_tenant            TEXT    NOT NULL,
    rulc_ruleid            TEXT    NOT NULL,
    rulc_id                UUID    NOT NULL,
    rulc_accesstypeid      TEXT    DEFAULT NULL,
    rulc_purposetag        TEXT    DEFAULT NULL,
    rulc_purposeid         TEXT    DEFAULT NULL,
    rulc_attributeid       TEXT    DEFAULT NULL,
    rulc_geoid             TEXT    DEFAULT NULL,
    rulc_isexternalsubject TEXT    DEFAULT NULL,
    rulc_subjectgroup      TEXT    DEFAULT NULL,
    rulc_geoloc            TEXT    DEFAULT NULL,
    PRIMARY KEY (rulc_tenant, rulc_ruleid, rulc_id),
    CONSTRAINT fk_rulecondition_rule
        FOREIGN KEY (rulc_tenant, rulc_ruleid)
        REFERENCES rule(rul_tenant, rul_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rulecondition_rule ON rulecondition(rulc_tenant, rulc_ruleid);

-- ── purpose ───────────────────────────────────────────────────────────────────
-- internal/models/purpose.go: PurposeRecord
-- The draft row always has version=0; active rows have version >= 1.
-- Required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Create purpose table
CREATE TABLE IF NOT EXISTS purpose (
    pu_tenant            varchar(64)   NOT NULL,
    pu_id                varchar(64)   NOT NULL,
    pu_name              varchar(100)  NOT NULL,
    pu_desc              varchar(512)  DEFAULT NULL,
    pu_version           int4          NOT NULL,
    pu_daysvalid         int4          DEFAULT NULL,
    pu_state             int4          DEFAULT 0,
    pu_lastmodifiedtime  int8          DEFAULT NULL,
    pu_termsofuseref     varchar(2048) DEFAULT NULL,
    pu_similartoversion  int4          NOT NULL,
    pu_datacount         int4          DEFAULT 0,
    pu_tags              varchar[]     DEFAULT NULL,
    pu_category          varchar(64)   DEFAULT 'default',
    pu_markedfordeletion bool          DEFAULT false,
    pu_documentlocales   varchar(1024) DEFAULT NULL,
    pu_customattributes  TEXT          DEFAULT NULL
);

-- Search indexes
CREATE INDEX pu_gx_01
    ON purpose
    USING gin (pu_tenant, pu_tags);

CREATE INDEX pu_ix_2
    ON purpose
    USING btree (
        pu_tenant,
        pu_id,
        pu_state,
        pu_markedfordeletion
    );

CREATE INDEX pu_tx_01
    ON purpose
    USING gin (
        pu_tenant,
        pu_name gin_trgm_ops
    );

-- Uniqueness indexes
CREATE UNIQUE INDEX pu_ux_1
    ON purpose
    USING btree (
        pu_tenant,
        pu_id,
        pu_version DESC
    );

-- Only one draft version per purpose
CREATE UNIQUE INDEX pu_ux_2
    ON purpose
    USING btree (
        pu_tenant,
        pu_id
    )
    WHERE pu_state = 0;

-- Active purpose names must be unique within a tenant
CREATE UNIQUE INDEX pu_ux_3
    ON purpose
    USING btree (
        pu_tenant,
        pu_name
    )
    WHERE pu_state = 1;

-- Self-referencing version relationship
ALTER TABLE purpose
    ADD CONSTRAINT pu_fk_similartoversion
    FOREIGN KEY (
        pu_tenant,
        pu_id,
        pu_similartoversion
    )
    REFERENCES purpose (
        pu_tenant,
        pu_id,
        pu_version
    )
    ON DELETE RESTRICT;

-- ── purposeaccesstype ─────────────────────────────────────────────────────────
-- internal/models/purpose_relations.go: PurposeAccessTypeRecord
-- FK references purpose by (tenant, id, version) to match the pu_ux_1 unique index.
CREATE TABLE IF NOT EXISTS purposeaccesstype (
    pat_tenant         TEXT    NOT NULL,
    pat_purposeid      TEXT    NOT NULL,
    pat_purposeversion INTEGER NOT NULL,
    pat_accesstypeid   TEXT    NOT NULL,
    PRIMARY KEY (pat_tenant, pat_purposeid, pat_purposeversion, pat_accesstypeid),
    CONSTRAINT pat_fk_purpose
        FOREIGN KEY (pat_tenant, pat_purposeid, pat_purposeversion)
        REFERENCES purpose(pu_tenant, pu_id, pu_version)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT pat_fk_accesstype
        FOREIGN KEY (pat_tenant, pat_accesstypeid)
        REFERENCES accesstype(at_tenant, at_id)
        ON DELETE RESTRICT
);

-- ── purposedata ───────────────────────────────────────────────────────────────
-- internal/models/purpose_relations.go: PurposeDataRecord
-- FK references purpose by (tenant, id, version) to match the pu_ux_1 unique index.
CREATE TABLE IF NOT EXISTS purposedata (
    pd_tenant          TEXT    NOT NULL,
    pd_purposeid       TEXT    NOT NULL,
    pd_purposeversion  INTEGER NOT NULL,
    pd_attributeid     TEXT    NOT NULL,
    pd_mandatory       BOOLEAN DEFAULT TRUE,
    pd_retentionperiod INTEGER DEFAULT NULL,
    PRIMARY KEY (pd_tenant, pd_purposeid, pd_purposeversion, pd_attributeid),
    CONSTRAINT pd_fk_purpose
        FOREIGN KEY (pd_tenant, pd_purposeid, pd_purposeversion)
        REFERENCES purpose(pu_tenant, pu_id, pu_version)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── purposedataaccesstype ─────────────────────────────────────────────────────
-- internal/models/purpose_relations.go: PurposeDataAccessTypeRecord
CREATE TABLE IF NOT EXISTS purposedataaccesstype (
    pdat_tenant         TEXT    NOT NULL,
    pdat_purposeid      TEXT    NOT NULL,
    pdat_purposeversion INTEGER NOT NULL,
    pdat_attributeid    TEXT    NOT NULL,
    pdat_accesstypeid   TEXT    NOT NULL,
    PRIMARY KEY (pdat_tenant, pdat_purposeid, pdat_purposeversion, pdat_attributeid, pdat_accesstypeid),
    CONSTRAINT pdat_fk_purposedata
        FOREIGN KEY (pdat_tenant, pdat_purposeid, pdat_purposeversion, pdat_attributeid)
        REFERENCES purposedata(pd_tenant, pd_purposeid, pd_purposeversion, pd_attributeid)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT pdat_fk_accesstype
        FOREIGN KEY (pdat_tenant, pdat_accesstypeid)
        REFERENCES accesstype(at_tenant, at_id)
        ON DELETE RESTRICT
);

-- ── purposerelationship ───────────────────────────────────────────────────────
-- internal/models/purpose_relations.go: PurposeRelationshipRecord
CREATE TABLE IF NOT EXISTS purposerelationship (
    pr_tenant      TEXT NOT NULL,
    pr_purposeid   TEXT NOT NULL,
    pr_extcategory TEXT NOT NULL,
    pr_extid       TEXT NOT NULL,
    PRIMARY KEY (pr_tenant, pr_purposeid, pr_extcategory, pr_extid)
);

CREATE INDEX IF NOT EXISTS pr_ix_1 ON purposerelationship(pr_tenant, pr_extcategory, pr_extid);

-- ── consent ───────────────────────────────────────────────────────────────────
-- internal/models/consent.go: ConsentRecord
CREATE TABLE IF NOT EXISTS consent (
    c_tenant               TEXT          NOT NULL,
    c_id                   TEXT          NOT NULL,
    c_version              INTEGER       NOT NULL DEFAULT 1,
    c_isexternalsubject    BOOLEAN       NOT NULL DEFAULT FALSE,
    c_subjectid            TEXT          NOT NULL,
    c_isglobal             BOOLEAN       NOT NULL,
    c_applicationid        TEXT          DEFAULT NULL,
    c_purposeid            TEXT          NOT NULL,
    c_purposeversion       INTEGER       NOT NULL,
    c_accesstypeid         TEXT          NOT NULL,
    c_state                SMALLINT      NOT NULL,
    c_createdtime          BIGINT        NOT NULL,
    c_lastmodifiedtime     BIGINT        NOT NULL,
    c_starttime            BIGINT        NOT NULL,
    c_endtime              BIGINT        DEFAULT NULL,
    c_geoip                TEXT          DEFAULT NULL,
    c_attributeid          TEXT          DEFAULT NULL,
    c_attributevalue       TEXT          DEFAULT NULL,
    c_geoid                TEXT          DEFAULT NULL,
    c_entity_type          TEXT          DEFAULT NULL,
    c_entity_id            TEXT          DEFAULT NULL,
    c_customattributes     TEXT          DEFAULT NULL,
    c_receipt_id           VARCHAR(256)  DEFAULT NULL,
    c_receipt              TEXT          DEFAULT NULL,
    c_key_id               VARCHAR(256)  DEFAULT NULL,
    c_receipt_format       VARCHAR(256)  DEFAULT NULL,
    CONSTRAINT c_pk PRIMARY KEY (c_tenant, c_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS c_ux_2
    ON consent (
        c_tenant, c_isexternalsubject, c_subjectid,
        c_purposeid, c_accesstypeid,
        COALESCE(c_attributeid,    ''),
        COALESCE(c_attributevalue, ''),
        COALESCE(c_applicationid,  '')
    );

CREATE INDEX IF NOT EXISTS c_ix_1 ON consent USING BTREE (c_tenant, c_lastmodifiedtime, c_id);
CREATE INDEX IF NOT EXISTS c_ix_2 ON consent USING BTREE (c_tenant, c_isexternalsubject, c_subjectid, c_lastmodifiedtime, c_id);
CREATE INDEX IF NOT EXISTS c_ix_3 ON consent (c_tenant, c_applicationid, c_id);