// Matrix/Hacker background effect
(function matrixEffect() {
  const canvas = document.getElementById("hacker-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const characters = "0101010101010101ABCDEFHIJKLMNOPQRSTUVWXYZ";
  const fontSize = 16;
  const columns = Math.floor(width / fontSize);
  const drops = Array(columns).fill(1);

  function draw() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#39ff14";
    ctx.font = fontSize + "px monospace";

    for (let i = 0; i < drops.length; i++) {
      const text = characters.charAt(Math.floor(Math.random() * characters.length));
      ctx.fillText(text, i * fontSize, drops[i] * fontSize);

      if (drops[i] * fontSize > height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    drops.length = Math.floor(width / fontSize);
    drops.fill(1);
  });

  setInterval(draw, 33);
})();
