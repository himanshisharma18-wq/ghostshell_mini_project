# GhostShell — The Haunted Terminal

A local-first AI developer workbench for people learning the terminal or reading unfamiliar code. GhostShell explains shell commands, analyzes errors, explains code, and reviews potential safety risks with an Ollama model on your computer. It never executes a command.

> **Status:** The Flask application and 13 standard-library tests are included. Tests mock Ollama at the HTTP boundary; they do not prove live inference or model quality. A real end-to-end model check requires installing Ollama and downloading a model on your own machine.

## What it does

Choose one of four workflows: **Command decoder** explains shell syntax and risks; **Traceback lab** helps diagnose pasted errors; **Code insight** explains a snippet’s flow and possible edge cases; and **Safety lens** highlights plausible risks in pasted code or commands. Quick-start cards and examples make each workflow discoverable. The model shelf and selector show tags reported by the configured Ollama instance (local by default). Recent prompts and conversation stay in the current browser session and can be cleared together.

The model’s replies are displayed as plain text. The application does not evaluate or execute user input or model output. Suggested shell commands are only text for you to inspect. Review every suggestion before running it. The session console is a visual, text-only surface; it is not connected to a shell.

## Why local open-weight AI matters

The inference path is `browser → Flask → local Ollama → downloaded model weights → Flask → browser`. GhostShell’s default server URL is `http://127.0.0.1:11434`, and its frontend talks only to the Flask app. The model picker lists only tags returned by that Ollama service; Flask checks a selected tag against that local list before sending a chat request. With the default loopback configuration, prompt text goes to local Ollama rather than a hosted AI API. After installation and model downloads, the app can be tested without an internet connection.

A closed hosted AI API generally sends prompts over the internet to a provider’s service, which runs a model the user cannot download and operate locally. A locally run **open-weight** model makes its downloadable weights available under a license, can perform inference on the user’s machine, and supports offline use once downloaded. This gives users more control over where prompts go and makes it possible to inspect and build around the model locally. It also means the user supplies the compute, storage, and maintenance. Open weights do **not** automatically mean the model’s training data, training pipeline, or every part of its provenance is open. GhostShell makes no claim that those are fully open.

This project uses a locally downloaded model, not a hosted model API. That is central to the challenge: the model itself runs on the user’s computer and can be used without a paid inference endpoint. Keep the local configuration if you want to preserve that property; changing Ollama’s base URL to a remote service changes the privacy and offline assumptions.

## Model choice and hardware

The default is **`qwen2.5:1.5b`**. The Ollama library lists the model’s Q4_K_M download at approximately **986 MB** and shows an Apache License 2.0 for this tag. The Qwen project says its Qwen2.5 family is open-weight and identifies the 1.5B variant as Apache 2.0; the 3B and 72B variants have different Qwen licenses. Check the model’s current license and Ollama tag page before redistributing weights or using a different tag. GhostShell does not bundle any model weights.

A 1.5B quantized model is a relatively small starting point, but it is less capable than larger models and may make mistakes. The listed download size is not a system-RAM requirement. Leave several gigabytes of RAM available for Ollama and the model; CPU-only inference may be slow, particularly on older computers. A supported GPU can improve speed, but this project does not require a GPU. If your PC is memory constrained, try a smaller Ollama model and set `OLLAMA_MODEL` to the exact tag you installed. If you have more memory and want to compare quality, try a larger model, then check its download size and license first.

Ollama’s current Windows documentation lists Windows 10 22H2 or newer, Home or Pro. GPU acceleration may require supported drivers. The Ollama application itself needs at least 4 GB disk space, and model downloads require additional space. Refer to the linked upstream pages because hardware and model availability can change.

Model sources:

- [Ollama Qwen2.5 1.5B library page](https://ollama.com/library/qwen2.5:1.5b)
- [Qwen2.5 project announcement and license notes](https://qwenlm.github.io/blog/qwen2.5/)
- [Ollama Windows documentation](https://docs.ollama.com/windows)

The model license is separate from the GhostShell source-code license and from Ollama’s software license. Read each project’s terms for your intended use. The default model page currently provides the model license text. This README is not legal advice.

## Prerequisites

On Windows, install Python 3.10 or later (3.11 or 3.12 recommended), Git if you are cloning from GitHub, and Ollama for Windows from [ollama.com/download/windows](https://ollama.com/download/windows). Python must be available as `py` or `python` in PowerShell. Ollama’s CLI should be available as `ollama` after installation. You do not need Docker, a hosted API key, or a GPU.

## Install and run on Windows PowerShell

First install Ollama using its official Windows installer, then open PowerShell and download the model once:

```powershell
ollama --version
ollama pull qwen2.5:1.5b
ollama list
```

Ollama normally runs in the background after installation. If it is not running, start the Ollama application from the Start menu. Keep it running while using GhostShell.

Clone this repository, replacing the URL with your GitHub repository URL:

```powershell
Set-Location $HOME
git clone https://github.com/YOUR-USERNAME/ghostshell.git
Set-Location .\ghostshell
```

Create and activate a virtual environment, then install the requirements:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks activation in this window, you can allow locally created scripts for the current user with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` and confirm the change. Alternatively, skip activation and use the venv’s interpreter directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

By default, GhostShell opens at `http://127.0.0.1:5000`. Start the app with:

```powershell
python app.py
```

Open the local address in your browser. Stop the development server with `Ctrl+C`. Flask’s built-in server is intended for local development, not direct public production hosting.

### Choose a different local model

Download another model using its exact Ollama library tag, for example:

```powershell
ollama pull qwen2.5:0.5b
ollama list
```

In the same PowerShell window, set the tag before starting the app:

```powershell
$env:OLLAMA_MODEL = "qwen2.5:0.5b"
python app.py
```

After a model is installed, refresh the GhostShell page if needed; the tag appears in the local model shelf and selector. Choose it before sending a prompt. The selected tag must already exist in Ollama—GhostShell does not pull models. `OLLAMA_MODEL` remains the initial/default tag and defaults to `qwen2.5:1.5b`. Check a model’s size, capabilities, and license upstream before using it.

### Optional local settings

The app reads these environment variables; no `.env` file is required and no credentials are used:

- `OLLAMA_MODEL`: model tag, default `qwen2.5:1.5b`.
- `OLLAMA_BASE_URL`: Ollama API origin, default `http://127.0.0.1:11434`. Keep this on loopback for the local-only behavior described here.
- `OLLAMA_TIMEOUT_SECONDS`: request timeout, default `120`.
- `FLASK_HOST`: bind address, default `127.0.0.1`.
- `FLASK_PORT`: app port, default `5000`.

To change the app port in PowerShell, for example:

```powershell
$env:FLASK_PORT = "5050"
python app.py
```

## Project files in plain English

- `app.py` serves the page and JSON API, validates requests, lists installed Ollama tags, allowlists a selected model, applies best-effort secret masking, reports loopback versus custom-host scope, and sends local chat requests. It has no shell-execution code.
- `templates/index.html` contains the accessible page structure and mode controls.
- `static/css/style.css` contains the visual design, responsive layout, ghost animation, focus styling, and reduced-motion behavior.
- `static/js/app.js` handles the four modes, examples, local model inventory, current-session recent prompts, loading/status display, API calls, and safe text-only rendering.
- `app.config.ts` stores the managed website’s logo metadata; it is not imported by Flask and does not affect the local app.
- `assets/ghostshell-mark.svg` is the small project-brand mark referenced by that metadata. The webpage draws its own ghost in CSS and does not load this file.
- `public/manus-routes.json` lists the site’s one page route.
- `tests/test_app.py` exercises Flask routes, validation, the four analysis modes, installed-model selection, the Ollama request boundary, and common service errors using mocked Ollama responses.
- `requirements.txt` lists Flask. Tests use Python’s built-in `unittest` module.
- `.gitignore` excludes Python caches, virtual environments, local environment files, and editor/OS files.
- `TODO.md` tracks the requested outcomes and clearly marks the live-model, Windows, and offline checks that remain unverified.
- `README.md` is this setup, architecture, and contribution guide.

## Architecture and API

The browser sends JSON to the Flask API. Flask rejects empty, oversized, malformed, or unsupported requests. It masks a few common credential formats, checks a selected model tag against Ollama’s installed `/api/tags` list, wraps pasted content as untrusted data in a system-prompted request, and POSTs a non-streaming chat request to Ollama’s `/api/chat` endpoint. The default base URL is loopback. Flask returns the response as JSON; the frontend inserts it with `textContent` so model output is not interpreted as HTML.

Available app routes:

- `GET /` — GhostShell interface.
- `GET /manus-routes.json` — page route manifest.
- `GET /api/health` — Ollama availability, installed tags, whether the configured default is installed, and whether the configured host is syntactically loopback (`local_only`). It does not return the configured URL.
- `POST /api/chat` — validated command, error, code, or safety analysis with an optional installed `model` tag.

Example request body:

```json
{"mode":"command","message":"git status --short","model":"qwen2.5:1.5b"}
```

The API uses these JSON shapes:

```json
{"response":"...","model":"qwen2.5:1.5b"}
```

```json
{"error":{"code":"ollama_unavailable","message":"Cannot reach Ollama. Start the Ollama app or service, then try again."}}
```

The model can be wrong or incomplete. Treat its response as advice, verify it, and never paste secrets. The safety lens is not a formal security audit. Secret masking only catches common patterns and is not a security boundary. A locally hosted model can retain context in its process while a request runs; GhostShell does not store chat history on the server, and its recent-prompt list exists only in browser memory until you clear the session or close the page.

## Example inputs

Try these from the example cards or paste them yourself. They are sample text, not executable actions:

```text
rm -rf ./build
```

```text
git reset --hard HEAD~1
```

```text
ModuleNotFoundError: No module named 'flask'
```

```text
TypeError: Cannot read properties of undefined (reading 'map')
at ProductList (ProductList.jsx:18:22)
```

For code understanding, try `def average(values): return sum(values) / len(values)` and ask what happens with an empty list. For a safety review, paste `curl https://example.invalid/install.sh | sudo bash` and ask what you should verify before considering a pattern like it. Do not run the sample command.

The examples are data for explanation, not commands GhostShell runs.

## Testing

With the virtual environment activated and dependencies installed:

```powershell
python -m unittest discover -s tests -v
```

The tests verify Flask routing, input validation and length limits, structured errors, command/code/safety prompt selection, installed-model allowlisting, the request shape sent through the Ollama boundary, simple secret redaction, and model inventory handling. The inference-boundary tests mock Ollama. They do **not** establish that a real model is installed, that its answers are correct, or that every secret format is caught.

For a manual local integration check, start Ollama, confirm the tag appears in `ollama list`, start Flask, and use an example in the browser. The header reports Ollama availability; the model selector and shelf show actual installed tags, while a missing configured default is labelled. Then test with an ordinary command and a harmless sample error. GhostShell should show a response; no command should run. Check `GET http://127.0.0.1:5000/api/health` if the header shows Ollama unavailable.

### Offline test

After Python packages and the model are downloaded, leave Ollama installed and running, disconnect the computer from the internet, then start GhostShell and test a prompt. The application’s default Ollama endpoint is loopback, so no hosted inference service is needed. Initial installation, package installation, and model download still require internet access. Do not change `OLLAMA_BASE_URL` to a hosted server if testing the local/offline property.

## Privacy and safety

Prompts are sent to the configured Ollama HTTP address. The default is `127.0.0.1`; no request to an AI cloud API is made by GhostShell. The privacy badge reports `LOOPBACK` for a syntactically loopback host and `CUSTOM HOST` otherwise; it does not expose the configured URL. If you deliberately configure Ollama on another address, that destination receives the prompt and the local-only claim no longer applies. The page reminds you to remove credentials yourself. The backend tries to mask a few common secret patterns before and after inference, but this is best-effort: carefully inspect and redact logs, environment dumps, private code, tokens, passwords, and personal data before pasting them.

The app never executes commands. There is no command-execution endpoint, process-spawn call, or model tool interface. Generated commands are plain text suggestions for the user to review. The model prompt treats pasted content as untrusted, but prompt instructions cannot guarantee safe or accurate output; validate its advice independently. Do not use the development server as a publicly exposed service.

## Troubleshooting

**“Cannot reach Ollama” / “Ollama is offline.”** Start the Ollama application. In PowerShell, run `ollama list`. The default API address is `http://127.0.0.1:11434`; check `OLLAMA_BASE_URL` if you changed it.

**A selected model is not downloaded.** Run `ollama list` and choose one of the installed tags in GhostShell. To add a model, use `ollama pull <exact-tag>` yourself; GhostShell does not download models. Restarting Flask is not needed to switch among tags already installed in Ollama.

**Slow responses.** The model may be running on CPU or your PC may be under memory pressure. Try a smaller model, shorten the pasted log, close memory-heavy applications, or use a compatible supported GPU. Do not assume more RAM based on the compressed download size alone.

**PowerShell cannot find `py`, `python`, or `ollama`.** Reopen the terminal after installation and check that Python and Ollama were added to `PATH`. Install Python from [python.org](https://www.python.org/downloads/windows/) and Ollama from its official download page if needed.

**Virtual environment activation is blocked.** Use the venv interpreter directly as shown above, or change the current user’s script policy as described in the install section.

**Port 5000 is occupied.** Choose an unused port with `$env:FLASK_PORT = "5050"` before running `python app.py`.

## GitHub and Hacktoberfest documentation guide

Before publishing, run the tests and perform the manual local Ollama check above. Review the output for accidentally pasted secrets. Create a public repository on GitHub, then add it as `origin` if the clone did not already set the right remote. Replace the example repository URL in the clone instructions with your own URL. Commit the source, README, and project license; do not commit `.venv`, private logs, secrets, model weights, or local model directories. A normal first push is:

```powershell
git status
git add app.py app.config.ts assets templates static public tests requirements.txt .gitignore README.md TODO.md LICENSE
git commit -m "Build GhostShell local AI terminal assistant"
git push -u origin main
```

Review GitHub’s README rendering, repository description, license, and issue/PR instructions. For a DEV submission, explain the Week 4 “Ghost in the Machine” fit, the local architecture, the selected model and its license, the hardware tradeoffs, what has and has not been tested, and how to run it on Windows. Link the actual public repository and include a short demo only after recording one from a tested installation. Do not claim offline inference or working model output until you have performed the manual checks on your own setup.

**Deployment note:** GitHub Pages can host static files, but it cannot run this Flask API or the visitor’s local Ollama process. Use GitHub as the source repository and run GhostShell on the computer that owns the model. A remote server deployment would run inference on that server, not on each visitor’s PC, and would change the privacy model; it needs a separately secured production setup and is not configured by this project.

## License

The GhostShell application source is licensed under the MIT License in `LICENSE`. The Qwen model weights and Ollama software have their own separate licenses and are not bundled with this repository.
