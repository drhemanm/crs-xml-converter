# OECD CRS XML Schema v3.0

The official schema package (`CrsXML_v3.0.xsd` and the four files it imports),
committed unmodified so generated filings can be validated in CI.
`src/crs/filing.test.js` validates every filing mode against it with `xmllint`.

Replace the files only with a newer official release, never by hand-editing:
a schema that has been "fixed" to accept our output proves nothing.

There is no v2.0 schema here, so v2.0 output is not schema-validated.
