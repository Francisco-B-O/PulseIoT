FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /workspace
COPY . .
RUN mvn clean package -DskipTests --projects common/common-lib,services/auth-service --also-make

FROM eclipse-temurin:21-jre-alpine
COPY --from=builder /workspace/services/auth-service/target/*.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
