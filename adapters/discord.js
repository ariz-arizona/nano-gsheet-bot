const router = require("express").Router();
const fetch = require("@vercel/fetch")(require("cross-fetch"));
const {
  InteractionType,
  InteractionResponseType,
  verifyKey,
  InteractionResponseFlags,
} = require("discord-interactions");

const { errorMessage, getPath } = require("../functions/helpers");

const help = require("../data/help.json");

const { DISCORD_PUB_KEY, DISCORD_TOKEN } = process.env;

router.post("/discord",
  async (_req, res, next) => {
    const signature = _req.get('X-Signature-Ed25519');
    const timestamp = _req.get('X-Signature-Timestamp');
    const isValidRequest = await verifyKey(
      _req.rawBody,
      signature,
      timestamp,
      DISCORD_PUB_KEY
    );
    
    if (!isValidRequest) {
      return res.status(401).send({ error: "Bad request signature " });
    }

    const message = _req.body;

    if (message.type === InteractionType.PING) {
      res.status(200).send({
        type: InteractionResponseType.PONG,
      });
    } else if (
      message.type === InteractionType.APPLICATION_COMMAND ||
      message.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE ||
      message.type === InteractionType.MESSAGE_COMPONENT
    ) {
      try {
        const command = message.data.name || message.data.custom_id;
        res.command = command;
        next();
      } catch (error) {
        console.log(error);
        res.status(200).send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: errorMessage(error),
          },
        });
      }
    } else {
      res.status(400).send({ error: "Unknown Type" });
    }
  },
  async (_req, res, next) => {
    const message = _req.body;
    const command = res.command;
    const options = {};
    try {
      if (message.data.options) {
        message.data.options.map((el) => {
          options[el.name] = el.value;
        });
      }
      if (message.data.custom_id) {
        options[message.data.custom_id] = message.data.values;
      }

      if (options.words) {
        if (options.words < 0) options.words = 'В';
        if (options.words > 65536) {
          throw new Error('too many words')
        }
      }

      if (options.target) {
        if (options.target > 65536) {
          throw new Error('too many words')
        }
      }

      console.log(`Получена команда ${command}\n${JSON.stringify(options)}`);

      if (!message.guild_id) {
        res.status(200).send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: `К сожалению, бот сейчас работает только в каналах на сервере :(`,
          },
        });
      }

      const { guild_id, token } = message;
      const { user } = message.member;

      switch (command) {
        case "set_admin":
          if (options.user === message.application_id) {
            res.status(200).send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                flags: InteractionResponseFlags.EPHEMERAL,
                content: 'Нано-бот не может быть администратором сам для себя',
              },
            });
          } else {
            fetch(`${getPath(_req)}/set_admin/${DISCORD_TOKEN}`, {
              method: "post",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ token, user_id: options.user, guild_id }),
            });

            await new Promise((resolve) => setTimeout(resolve, 200));

            res.status(200).send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                // flags: InteractionResponseFlags.EPHEMERAL,
                content: `Пользователь <@${user.id}> устанавливает администратора <@${options.user}>`,
              },
            });
          }
          break;

        case "set_sheet":
          const { sheet_id } = options;

          fetch(`${getPath(_req)}/set_sheet/${DISCORD_TOKEN}`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token, sheet_id, guild_id, user_id: user.id }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> указывает гугл-таблицу`,
            },
          });

          break;

        case "set_target":
          const { target } = options;

          fetch(`${getPath(_req)}/set_target/${DISCORD_TOKEN}`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token, target, guild_id, user_id: user.id }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> указывает цель челленджа`,
            },
          });

          break;


        case "help":
          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: help.data,
            },
          });

          break;
        case "stat":
          fetch(`${getPath(_req)}/bot_stat/${DISCORD_TOKEN}`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token, userId: user.id, guild_id }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> запросил статистику`,
            },
          });

          break;
        case "nn_report":
          fetch(`${getPath(_req)}/bot_add/${DISCORD_TOKEN}`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              words: options.words,
              comment: options.comment,
              guild_id,
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> пишет отчет`,
            },
          });
          break;
        case 'add_words_user':
          const username = message.data.values[0].split('_')[0];
          const words = message.data.values[0].split('_')[1];
          const day = message.data.values[0].split('_')[2];

          fetch(`${getPath(_req)}/bot_add/${DISCORD_TOKEN}`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              username,
              words,
              day,
              guild_id
            }),
          });
          break;
        case 'nn_today':
          fetch(`${getPath(_req)}/bot_add/${DISCORD_TOKEN}`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              words: options.words,
              comment: options.comment,
              day: 'today',
              guild_id,
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> пишет отчет за сегодня`,
            },
          });
          break;
        case 'nn_yesterday':
          fetch(`${getPath(_req)}/bot_add/${DISCORD_TOKEN}`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              words: options.words,
              comment: options.comment,
              day: 'yesterday',
              guild_id,
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> пишет отчет за вчера`,
            },
          });
          break;
        case /^free_date_/.test(command) && command:
          const args = command.replace('free_date_', '').split('_');
          options.cell = args[0];
          options.date = args[1];
          options.words = args[2];
          options.original_id = args[3];
          fetch(`${getPath(_req)}/bot_add_two/${DISCORD_TOKEN}`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messageData: message.message,
              token,
              username: user.username,
              cell: options.cell,
              date: options.date,
              words: options.words,
              original_id: options.original_id,
              guild_id
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь ${user.username} нажал на кнопку`,
            },
          });
          break;
        case "add_user":
          fetch(`${getPath(_req)}/bot_add_user/${DISCORD_TOKEN}`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              username: options.name || user.username,
              target: options.target,
              guild_id
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> регистрируется на пендель`,
            },
          });
          break;
        default:
          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: `Я этого не умею :(`,
            },
          });
      }
    } catch (error) {
      console.log(error);
      res.status(200).send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: errorMessage(error),
        },
      });
    }
  }
);

module.exports = router;