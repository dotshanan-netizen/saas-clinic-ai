# Clinova WhatsApp Integration Runbook

This document details the step-by-step procedure to integrate WhatsApp Cloud API for the Clinova SaaS platform, covering setup, local development networking, verification checks, troubleshooting, and tenant onboarding.

---

## 🚀 1. Developer Setup & Infrastructure (Named Tunnels)
To maintain a stable development link and avoid changing the Meta callback URL constantly, we utilize **Cloudflare Named Tunnels** pointing to a dedicated development subdomain.

### Prerequisites
* A custom domain managed on Cloudflare (e.g., `arafadesign.com`).
* The local `cloudflared` binary.

### Setup Instructions
1. **Authorize Cloudflare:**
   ```bash
   .\cloudflared.exe tunnel login
   ```
   Select your domain in the browser window to authorize.
2. **Create the Tunnel:**
   ```bash
   .\cloudflared.exe tunnel create clinova-dev
   ```
   Save the printed **Tunnel UUID**.
3. **Configure DNS CNAME Route:**
   ```bash
   .\cloudflared.exe tunnel route dns clinova-dev dev-webhook.yourdomain.com
   ```
4. **Local Configuration:**
   Copy `cloudflared.config.yml.template` to `cloudflared.config.yml` and insert your Tunnel UUID and user directory paths:
   ```yaml
   tunnel: <TUNNEL_UUID>
   credentials-file: C:/Users/<USERNAME>/.cloudflared/<TUNNEL_UUID>.json
   ingress:
     - hostname: dev-webhook.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
5. **Run the Tunnel:**
   ```bash
   npm run tunnel
   ```

---

## 📱 2. Meta WhatsApp App Configuration
1. Go to the [Meta Developer Console](https://developers.facebook.com).
2. Select your WhatsApp App.
3. Under **WhatsApp -> Configuration**, set the Callback URL:
   `https://dev-webhook.yourdomain.com/api/webhook/whatsapp`
4. Set the Verify Token (matching `WHATSAPP_VERIFY_TOKEN` in `.env`, e.g., `RIVAL_CLINIC_VERIFY_TOKEN`).
5. Click **Verify and Save**.
6. Under **Webhook fields**, click **Subscribe** next to `messages` to route user message payloads to your webhook.

---

## 👥 3. Tenant Onboarding Checklist
To onboard a new clinic/tenant onto the platform:
1. Obtain the clinic's:
   * **WhatsApp Phone Number ID** (e.g., `1118087068064035`)
   * **WhatsApp Business Account ID (WABA)** (e.g., `1203758808582942`)
   * Unique verify token for the clinic (optional, if using tenant-level overrides instead of global fallback).
2. Insert a record into the `Clinic` database table using the onboarding script or Prisma:
   ```bash
   npm run onboard-tenant --slug="new-clinic" --name="New Clinic Name" --phoneId="PhoneID" --wabaId="WABAID" --token="UniqueVerifyToken"
   ```
3. The new tenant is now instantly ready to route WhatsApp messages through the central webhook without any redeployment.

---

## 🛠️ 4. Troubleshooting Matrix (RCA Guide)

| Error Scenario | Possible Cause | Verification Step | Solution |
| :--- | :--- | :--- | :--- |
| **Verify Token couldn't be validated** | Token mismatch | Check `.env` token matches what was typed in Meta dashboard. | Align the tokens. |
| **No GET request in Next.js logs** | DNS Propagation Delay | Run `Resolve-DnsName -Name arafadesign.com -Type NS` to check if NS updated. | Wait 15-30 minutes for DNS caching at Meta's backend to refresh. |
| **No GET request in Next.js logs** | Cloudflare WAF Block | Check **Cloudflare -> Security -> Events** for block events on `/api/webhook/whatsapp`. | Create a bypass custom rule in Cloudflare WAF for the path `/api/webhook/whatsapp`. |
| **404 Bad Response in Debugger** | Request hitting old host | Inspect Sharing Debugger. If it mentions `htdocs_error` or Hostinger, it hit the old host. | Wait for DNS cache to update, or force scrape in Facebook Sharing Debugger. |
