FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /usr/src/app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o restante dos arquivos do projeto
COPY . .

# Garantir a geração do cliente do Prisma
RUN npx prisma generate

# Expor a porta em que o servidor roda
EXPOSE 8333

# Comando para iniciar o servidor
CMD ["npm", "run", "start"]
