FROM eclipse-temurin:21-jre-jammy AS java
FROM node:22-bookworm-slim
COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"
ENV FIREBASE_EMULATORS_PATH=/opt/firebase-emulators
WORKDIR /emulator
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && ./node_modules/.bin/firebase setup:emulators:firestore \
    && ./node_modules/.bin/firebase setup:emulators:ui
COPY firebase.json firebase.test.json firestore.rules start.mjs ./
EXPOSE 8080 4001 4400 4500 9150
CMD ["node", "start.mjs"]
