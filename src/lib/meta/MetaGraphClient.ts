const META_API_VERSION = "v18.0";

export class MetaGraphClient {
  private static getUrl(path: string): string {
    return `https://graph.facebook.com/${META_API_VERSION}/${path}`;
  }

  /**
   * Fetch WABAs for a given business account using the system user token
   */
  static async fetchWabas(token: string, businessId: string) {
    const res = await fetch(this.getUrl(`${businessId}/owned_whatsapp_business_accounts`), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
  }

  /**
   * Fetch registered phone numbers for a specific WABA
   */
  static async fetchPhones(token: string, wabaId: string) {
    const res = await fetch(this.getUrl(`${wabaId}/phone_numbers`), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
  }

  /**
   * Subscribe App to the selected WABA
   */
  static async subscribeApp(token: string, wabaId: string) {
    const res = await fetch(this.getUrl(`${wabaId}/subscribed_apps`), {
      method: "POST",
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
  }

  /**
   * Query the live status and verified display name of a phone number
   */
  static async verifyPhone(token: string, phoneId: string) {
    const res = await fetch(this.getUrl(`${phoneId}?fields=status,verified_name`), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
  }
}
