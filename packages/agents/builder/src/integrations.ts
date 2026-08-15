export type PaymentLink = { url: string; id: string };
export type DeployResult = { url: string; deploy_id: string };

export class IntegrationsClient {
  constructor(private readonly baseUrl: string) {}

  async createPaymentLink(input: {
    project_id: string;
    product_name: string;
    amount_usd?: number;
  }): Promise<PaymentLink> {
    const res = await fetch(`${this.baseUrl}/stripe/payment-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`stripe/payment-link failed: ${res.status}`);
    return (await res.json()) as PaymentLink;
  }

  async deploy(input: { project_id: string; html: string; name: string }): Promise<DeployResult> {
    const res = await fetch(`${this.baseUrl}/render/deploy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`render/deploy failed: ${res.status}`);
    return (await res.json()) as DeployResult;
  }
}
