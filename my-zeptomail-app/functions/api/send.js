export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const formData = await request.formData();

    const from = formData.get('from');
    const displayName = formData.get('displayName');
    const replyTo = formData.get('replyTo');
    const rawTo = formData.get('to');
    const subject = formData.get('subject');
    const message = formData.get('message');
    const file = formData.get('file');

    // Parse recipient list by splitting on commas or newlines
    const recipientEmails = rawTo
      .split(/[\n,]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (recipientEmails.length === 0) {
      return Response.json({ error: "No valid recipient email addresses provided." }, { status: 400 });
    }

    if (recipientEmails.length > 500) {
      return Response.json({ error: "Maximum limit is 500 recipients per request." }, { status: 400 });
    }

    // Map recipients into ZeptoMail JSON structure
    const toArray = recipientEmails.map(email => ({
      email_address: {
        address: email
      }
    }));

    // Build payload
    const payload = {
      from: {
        address: from,
        name: displayName || ""
      },
      to: toArray,
      subject: subject,
      htmlbody: `<div style="font-family:sans-serif;font-size:14px;color:#333;">${message.replace(/\n/g, '<br>')}</div>`
    };

    if (replyTo) {
      payload.reply_to = [{ address: replyTo }];
    }

    // Process file attachment
    if (file && typeof file === 'object' && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Content = btoa(binary);

      payload.attachments = [
        {
          content: base64Content,
          name: file.name
        }
      ];
    }

    // Determine ZeptoMail Endpoint: single email vs batch email API endpoint
    const endpoint = recipientEmails.length > 1 
      ? "https://api.zeptomail.com/v1.1/email/batch" 
      : "https://api.zeptomail.com/v1.1/email";

    const zeptoResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": env.ZEPTOMAIL_API_TOKEN
      },
      body: JSON.stringify(payload)
    });

    const data = await zeptoResponse.json();

    if (!zeptoResponse.ok) {
      return Response.json({ error: data.message || "ZeptoMail API error" }, { status: 400 });
    }

    return Response.json({ success: true, count: recipientEmails.length, data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}