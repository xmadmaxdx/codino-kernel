# 1. Use Node as the base
FROM node:18-bullseye

# 2. Install Java and Python
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 3. Create app directory
WORKDIR /usr/src/app

# 4. Install dependencies
COPY package*.json ./
RUN npm install

# 5. Copy your code
COPY . .

# 6. Start the server
EXPOSE 3000
CMD [ "node", "index.js" ]
