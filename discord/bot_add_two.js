const { createClient } = require("@supabase/supabase-js");
const router = require("express").Router();
const fetch = require("@vercel/fetch")(require("cross-fetch"));
const {
    InteractionResponseFlags,
} = require("discord-interactions");
const { google } = require("googleapis");
const emoji = require("emoji.json");

const { auth, getReaction, getRandomInt } = require("../functions/helpers");
const { sendErrorToDiscord, sendMsgToDiscord } = require("./send_msg_func");

const { DISCORD_TOKEN,
    SUPABASE_URL, SUPABASE_KEY,
    GOOGLE_API_KEY } = process.env;

router.post(`/bot_add_two/${DISCORD_TOKEN}`, async (_req, res) => {
    const message = _req.body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    try {
        const {
            messageData,
            token,
            cell,
            date,
            words,
            username,
            _comment,
            original_id,
            guild_id,
        } = message;

        const { data: db_data } = await supabase.from('sheets').select('sheet_id').eq('server_id', guild_id);

        if (!db_data.length) {
            throw new Error('no spreadsheet');
        }

        const SPREADSHEET_ID = db_data[0].sheet_id;

        let comment;
        if (_comment !== undefined) {
            comment = _comment
        } else {
            const commentRaw = messageData.content.split('\n').find(el => el.split(': ')[0] === 'Комментарий');
            comment = commentRaw ? commentRaw.split(': ')[1] : false;
        }
        const sheets = google.sheets({
            version: "v4",
            auth: GOOGLE_API_KEY,
        });

        const data = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            includeGridData: true,
            ranges: cell,
        });

        const value = data.data.sheets[0].data[0].rowData[0].values[0].formattedValue;
        if (value === words) {
            const duplicateBody = {
                flags: InteractionResponseFlags.EPHEMERAL,
                content: ['Кажется, такой отчет уже сдан :(', `День: ${date}`, `Слов: ${words}`].join('\n'),
            };
            // await sendMsgToDiscord(false, `${token}/messages/${original_id}`, 'DELETE');
            await sendMsgToDiscord(duplicateBody, token);
        } else {
            // исправляем сообщение с кнопками, если данные о нем переданы
            if (messageData) {
                const body = {
                    flags: InteractionResponseFlags.EPHEMERAL,
                    content: `Пользователь ${username} готов вписать слова (${words}) в дату ${date}`,
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 2,
                                    label: `${words} слов в день ${date}`,
                                    custom_id: `free_date_${cell}_${date}`,
                                    disabled: true
                                },
                            ],
                        },
                    ],
                };
                await sendMsgToDiscord(body, `${token}/messages/${messageData.id}`, 'PATCH');
            }
            // если есть оригинальное сообщение, то есть после кнопки, то удаляем сообщение-после-кнопки
            if (original_id) {
                await sendMsgToDiscord(false, `${token}/messages/@original`, 'DELETE');
            }

            const jwt = await auth();

            sheets.spreadsheets.values.update({
                auth: jwt,
                spreadsheetId: SPREADSHEET_ID,
                range: `Список участников!${cell}`,
                valueInputOption: "USER_ENTERED",
                resource: { values: [[words]] },
            });

            const randomEmojiCount = getRandomInt(1, 8);
            const randomEmoji = [];
            for (let index = 0; index < randomEmojiCount; index++) {
                randomEmoji.push(emoji[getRandomInt(0, emoji.length - 1)].char);
            }

            const txt = [`Пользователь: **${username}**`, `День: ${date}`, `Слов: ${words}`];
            if (comment) txt.push(`Комментарий: *${comment}*`)
            txt.push(`\nСлучайный эмоджи от бота: ${randomEmoji.join(' ')}`);

            const checkReaction = '\u2705'; // check
            const reaction = getReaction(words);

            let response;
            if (original_id) {
                response = await sendMsgToDiscord({ content: txt.join('\n') }, `${token}/messages/${original_id}`, 'PATCH');
            } else {
                response = await sendMsgToDiscord({ content: txt.join('\n') }, `${token}/messages/@original`, 'PATCH');
            }
            const msg = await response.json();

            await fetch(
                `https://discord.com/api/v9/channels/${msg.channel_id}/messages/${msg.id}/reactions/${checkReaction}/@me`,
                {
                    headers: { authorization: `Bot ${DISCORD_TOKEN}` },
                    method: 'PUT',
                }
            );
            if (reaction) {
                await fetch(
                    `https://discord.com/api/v9/channels/${msg.channel_id}/messages/${msg.id}/reactions/${reaction}/@me`,
                    {
                        headers: { authorization: `Bot ${DISCORD_TOKEN}` },
                        method: 'PUT',
                    }
                );
            }
        }
    } catch (error) {
        await sendErrorToDiscord(error, message.token);
    }
    res.sendStatus(200);
});

module.exports = router;