/**
 * Slack Web API helpers.
 * Requires SLACK_BOT_TOKEN env var.
 */

const BASE = "https://slack.com/api";

async function slackCall(method, body) {
  const res = await fetch(`${BASE}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Slack ${method} error:`, data.error, data);
    throw new Error(`Slack ${method}: ${data.error}`);
  }
  return data;
}

export async function postMessage({ channel, text, blocks, thread_ts }) {
  return slackCall("chat.postMessage", {
    channel,
    text,
    blocks,
    thread_ts,
    unfurl_links: false,
  });
}

export async function updateMessage({ channel, ts, text, blocks }) {
  return slackCall("chat.update", { channel, ts, text, blocks });
}

export async function getFileInfo(file_id) {
  const data = await slackCall("files.info", { file: file_id });
  return data.file;
}

export async function downloadFile(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  return res.arrayBuffer();
}

export async function addReaction(channel, timestamp, name) {
  try {
    return await slackCall("reactions.add", { channel, timestamp, name });
  } catch (e) {
    // ignore already_reacted
    if (!e.message.includes("already_reacted")) throw e;
  }
}
