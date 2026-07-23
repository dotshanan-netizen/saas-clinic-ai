# Clinova Infrastructure Setup Guide: Cloudflare Named Tunnels

To keep the development environment stable and avoid changing the Meta WhatsApp Webhook Callback URL continuously, we utilize **Cloudflare Named Tunnels** to expose the local server via a static domain name.

---

## 📋 Prerequisites
1. A **Cloudflare Account**.
2. A **Custom Domain** added to your Cloudflare account (e.g., `clinova.ai` or any personal domain).
3. The `cloudflared` utility:
   - On Windows, a local `cloudflared.exe` is already provided in the project root.
   - On Mac/Linux, install it via Homebrew (`brew install cloudflared`) or download it from the official site.

---

## 🛠️ Step-by-Step Setup

### Step 1: Login to Cloudflare
Authenticate the `cloudflared` CLI tool with your Cloudflare account:
- **Windows (using local executable):**
  ```bash
  .\cloudflared.exe tunnel login
  ```
- **macOS / Linux (using global executable):**
  ```bash
  cloudflared tunnel login
  ```
*This command will open a browser window. Log in to your Cloudflare account and select the domain you wish to authorize.*

---

### Step 2: Create the Named Tunnel
Create a new Named Tunnel (e.g., `clinova-dev`):
- **Windows:**
  ```bash
  .\cloudflared.exe tunnel create clinova-dev
  ```
- **macOS / Linux:**
  ```bash
  cloudflared tunnel create clinova-dev
  ```
*This command will generate a JSON credentials file under your user's `~/.cloudflared/` directory and print a **Tunnel UUID**.*

---

### Step 3: Route DNS Traffic
Create a DNS CNAME record pointing your chosen subdomain to your tunnel:
- **Windows:**
  ```bash
  .\cloudflared.exe tunnel route dns clinova-dev dev-webhook.yourdomain.com
  ```
- **macOS / Linux:**
  ```bash
  cloudflared tunnel route dns clinova-dev dev-webhook.yourdomain.com
  ```
*(Replace `dev-webhook.yourdomain.com` with your actual subdomain and domain).*

---

### Step 4: Configure the Local Setup
1. Copy the template configuration file in the project root:
   ```bash
   cp cloudflared.config.yml.template cloudflared.config.yml
   ```
2. Open `cloudflared.config.yml` and replace:
   - `<TUNNEL_UUID>` with your generated tunnel UUID.
   - `<USERNAME>` with your Windows/macOS user account name.
   - `dev-webhook.clinova.ai` under `hostname` with your chosen subdomain.

---

### Step 5: Start the Tunnel
To launch the tunnel locally, simply run:
```bash
npm run tunnel
```
This runs the local/global binary utilizing your static configurations. Once running, your local Next.js server at `http://localhost:3000` is securely exposed through `https://dev-webhook.yourdomain.com` permanently!

---

## 🔒 Security Note
The `cloudflared.config.yml` contains sensitive paths and UUID identifiers. It is ignored by git in [.gitignore](file:///C:/Users/20101/saas-clinic-ai/.gitignore) to prevent accidental credential commits.
