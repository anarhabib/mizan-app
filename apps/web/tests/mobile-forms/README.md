# Mobile form regression checks

The fixture loads the real ProductPanel, SupplierPicker, Input and repair editor with a stubbed supplier response. It needs no API, database or credentials. Run it after changing those components or their layout. Also exercise the affected production form if its validation or action placement differs from the fixture.

Build the contracts and start Vite from the repository root in one PowerShell terminal.

```powershell
pnpm.cmd --filter @mizan/contracts build
pnpm.cmd --filter web exec vite --host 127.0.0.1 --port 5191 --strictPort
```

In another terminal, point `NODE_PATH` at an existing Playwright installation with Chromium available. To provision local tools without changing workspace dependencies, use the ignored `.local` directory.

```powershell
New-Item -ItemType Directory -Force .local/browser-tools | Out-Null
pnpm.cmd --dir .local/browser-tools add playwright
pnpm.cmd --dir .local/browser-tools exec playwright install chromium
$env:NODE_PATH = (Resolve-Path .local/browser-tools/node_modules).Path
node --test apps/web/tests/mobile-forms/mobile-forms.test.cjs
```

Set `MIZAN_FORM_BROWSER_CHANNEL=msedge` to use a local Edge installation in place of Playwright's bundled Chromium.

The tests cover 320px and 390px mobile layouts and the 1280px desktop sheet. Chromium simulates a reduced visual viewport and exercises touch selection and repeated swipes past the end of a ten-row fixture. The fixture also checks inline and footer actions, row addition and removal, collapsed sections, and inline errors. For physical iOS Safari and Android Chrome, check keyboard open and close, repeated swipes at the end of the real ten-product form, picker taps while the keyboard is open, native date controls, and footer clearance around system insets. Repeat in installed PWAs if the form is used there. Record those device results separately.
