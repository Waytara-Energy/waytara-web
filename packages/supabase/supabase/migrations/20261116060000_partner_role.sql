-- WayTara Partner Network: a new kind of account, 'partner'. An approved applicant sets a password from their private link and gets one of these. It is deliberately
-- the LEAST privileged role there is: no policy in the database mentions it, so by default it can read and write nothing through the database directly. What a partner
-- sees is a handful of pages in the admin app that read and write only the partner's own application, through the server (see apps/admin, the /partner pages).
--
-- Kept in a file of its own because a new enum value cannot be used in the same transaction that adds it.

alter type waytara.user_role add value if not exists 'partner';
