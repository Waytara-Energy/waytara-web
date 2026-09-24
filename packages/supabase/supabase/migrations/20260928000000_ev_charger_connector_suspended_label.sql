-- Precision fix caught while auditing the EV charger vocabulary for
-- mismatches: instrument_enum_values labeled code 3 as plain "Suspended",
-- but the real OCPP 1.6 StatusNotification.status enum (and the
-- simulator's own comment) call it SuspendedEVSE specifically (a
-- charger/BMS-initiated pause, distinct from the spec's separate
-- SuspendedEV code this catalog doesn't model). Not a functional bug —
-- the code itself was always correct — just an imprecise label.
update waytara.instrument_enum_values
set label = 'Suspended (EVSE)'
where enum_ref = 'connector_status' and code = '3';
