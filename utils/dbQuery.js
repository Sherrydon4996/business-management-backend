export const dbQuery = async (promise, timeout = 8000) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("DATABASE_TIMEOUT")), timeout),
  );

  return Promise.race([promise, timeoutPromise]);
};
