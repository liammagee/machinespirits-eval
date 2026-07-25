# temp-safe compatibility package

This private package preserves the small `temp@0.9.x` callback/Promise API used
by `electron-winstaller`, while replacing its unsupported
`rimraf -> glob -> minimatch -> brace-expansion` cleanup chain with Node's
built-in `fs.rm` and `fs.rmSync` APIs.

It is deliberately narrow packaging infrastructure, excluded from the
Scriptorium application bundle, and may be removed as soon as
`electron-winstaller` publishes an equivalent dependency update.
