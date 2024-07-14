import type { Direction, ImMoving, Player } from "./common.mjs";
import * as common from "./common.mjs";

const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyA: "left",
  KeyD: "right",
  KeyS: "down",
  KeyW: "up",
};

(async () => {
  const gameCanvas = document.getElementById("game") as HTMLCanvasElement | null;
  if (gameCanvas === null) throw new Error("No element with id `game`");
  gameCanvas.width = common.WORLD_WIDTH;
  gameCanvas.height = common.WORLD_HEIGHT;
  const ctx = gameCanvas.getContext("2d");
  if (ctx === null) throw new Error("2d canvas is not supported");

  const ws = new WebSocket(`ws://${window.location.hostname}:${common.SERVER_PORT}`);
  let me: Player | undefined = undefined;
  const players = new Map<number, Player>();
  ws.addEventListener("close", (event) => {
    console.log("WEBSOCKET CLOSE", event);
  });
  ws.addEventListener("error", (event) => {
    // TODO: reconnect on errors
    console.log("WEBSOCKET ERROR", event);
  });
  ws.addEventListener("message", (event) => {
    if (me === undefined) {
      const message = JSON.parse(event.data);
      if (common.isHello(message)) {
        me = {
          id: message.id,
          x: message.x,
          y: message.y,
          moving: {
            left: false,
            right: false,
            up: false,
            down: false,
          },
          style: message.style,
        };
        players.set(message.id, me);
        console.log(`Connected as player ${me.id}`);
      } else {
        console.log("Received bogus-amogus message from server", message);
        ws.close();
      }
    } else {
      const message = JSON.parse(event.data);
      console.log("Received message", message);
      if (common.isPlayerJoined(message)) {
        players.set(message.id, {
          id: message.id,
          x: message.x,
          y: message.y,
          moving: {
            left: false,
            right: false,
            up: false,
            down: false,
          },
          style: message.style,
        });
      } else if (common.isPlayerLeft(message)) {
        players.delete(message.id);
      } else if (common.isPlayerMoving(message)) {
        const player = players.get(message.id);
        if (player === undefined) {
          console.log(`Received bogus-amogus message from server. We don't know anything about player with id ${message.id}`, message);
          ws.close();
          return;
        }
        player.moving[message.direction] = message.start;
        player.x = message.x;
        player.y = message.y;
      } else {
        console.log("Received bogus-amogus message from server", message);
        ws.close();
      }
    }
  });
  ws.addEventListener("open", (event) => {
    console.log("WEBSOCKET OPEN", event);
  });

  let previousTimestamp = 0;
  const frame = (timestamp: number) => {
    const deltaTime = (timestamp - previousTimestamp) / 1000;
    previousTimestamp = timestamp;

    ctx.fillStyle = "#202020";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // TODO: indicate different states of the client. Like 'connecting', 'error', etc.
    players.forEach((player) => {
      if (me !== undefined) {
        common.updatePlayer(player, deltaTime);
        ctx.fillStyle = player.style;
        ctx.fillRect(player.x, player.y, common.PLAYER_SIZE, common.PLAYER_SIZE);
        if (player.id === me.id) {
          ctx.strokeStyle = "white";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.strokeRect(player.x, player.y, common.PLAYER_SIZE, common.PLAYER_SIZE);
          ctx.stroke();
        }
      }
    });

    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame((timestamp) => {
    previousTimestamp = timestamp;
    window.requestAnimationFrame(frame);
  });

  window.addEventListener("keydown", (e) => {
    if (me !== undefined) {
      if (!e.repeat) {
        const direction = DIRECTION_KEYS[e.code];
        if (direction !== undefined) {
          common.sendMessage<ImMoving>(ws, {
            kind: "ImMoving",
            start: true,
            direction,
          });
        }
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (me !== undefined) {
      if (!e.repeat) {
        const direction = DIRECTION_KEYS[e.code];
        if (direction !== undefined) {
          common.sendMessage<ImMoving>(ws, {
            kind: "ImMoving",
            start: false,
            direction,
          });
        }
      }
    }
  });
})();
