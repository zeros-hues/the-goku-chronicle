import axios from "axios";

const BASE_URL = "https://graph.facebook.com/v18.0";

export async function sendWhatsAppMessage(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;

  await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{ data: string; mimeType: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;

  const { data: mediaInfo } = await axios.get(`${BASE_URL}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const response = await axios.get(mediaInfo.url, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: "arraybuffer",
  });

  const base64 = Buffer.from(response.data).toString("base64");
  return { data: base64, mimeType: mediaInfo.mime_type };
}
