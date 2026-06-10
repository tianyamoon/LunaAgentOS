export function scheduleStartupTasks(tasks, {
  requestFrame = (callback) => requestAnimationFrame(callback),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  delayMs = 40,
  onError = (error) => console.error(error),
} = {}) {
  const queue = Array.isArray(tasks) ? tasks.filter((task) => typeof task === "function") : [];
  requestFrame(() => requestFrame(() => {
    void runStartupTasks(queue, { setTimer, delayMs, onError });
  }));
}

export async function runStartupTasks(tasks, { setTimer, delayMs, onError }) {
  for (const task of tasks) {
    await new Promise((resolve) => setTimer(resolve, delayMs));
    try {
      await task();
    } catch (error) {
      onError(error);
    }
  }
}
