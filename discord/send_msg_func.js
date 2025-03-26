const fetch = require("@vercel/fetch")(require("cross-fetch"));

const { errorMessage } = require("../functions/helpers");

const { DISCORD_APPLICATION_ID, DISCORD_TOKEN } = process.env;

const sendErrorToDiscord = async (error, token) => {
    console.log(error);
    await fetch(
        `https://discord.com/api/v9/webhooks/${DISCORD_APPLICATION_ID}/${token}`,
        {
            headers: { "Content-Type": "application/json" },
            method: "post",
            body: JSON.stringify({
                content: errorMessage(error),
            }),
        }
    );
}

const sendMsgToDiscord = async (body, url, method = "POST", auth = false) => {
    const content = {
        headers: { "Content-Type": "application/json" },
        method: method,
    };
    if (body) {
        content.body = JSON.stringify(body)
    }
    if (auth) {
        content.headers.authorization = `Bot ${DISCORD_TOKEN}`;
    }
    return await fetch(
        `https://discord.com/api/v9/webhooks/${DISCORD_APPLICATION_ID}/${url}`,
        content
    );
}

module.exports = { sendErrorToDiscord, sendMsgToDiscord }