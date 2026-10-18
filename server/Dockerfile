# API image. Build from the repository root (the build reads ../shared/economy.json):
#   docker build -f server/Dockerfile -t dinomutation-api .
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY shared/economy.json shared/economy.json
COPY server/.mvn server/.mvn
COPY server/mvnw server/pom.xml server/
WORKDIR /app/server
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY server/src src
# Tests need Docker (Testcontainers) and already run in CI.
RUN ./mvnw -B -q package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/server/target/*.jar app.jar
# Small free-tier containers: let the heap follow the container memory limit.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
