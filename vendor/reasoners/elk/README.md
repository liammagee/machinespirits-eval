# ELK Reasoner

`npm run ontology:download-elk` downloads `elk-standalone-0.4.3.jar` here.

The jar is intentionally git-ignored. The Node pilot uses the EYE/N3 reasoner so it
can run without Java; ELK is provided as the OWL 2 EL classification path once a
Java runtime is available.
