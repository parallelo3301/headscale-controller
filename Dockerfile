FROM denoland/deno:1.39.2

WORKDIR /app

# Prefer not to run as root.
USER deno

# These steps will be re-run upon each file change in your working directory:
COPY main.ts .
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts

CMD ["run", "--unstable", "--allow-read=/var/run/docker.sock", "--allow-write=/var/run/docker.sock", "--allow-net", "--allow-env=PORT,HEADSCALE_SERVER_URL,USE_SOCAT", "main.ts"]
