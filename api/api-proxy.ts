import { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";
import qs from "qs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Replace PRIVATE_API_KEY with your private API key.
const { MORALIS_API_KEY, SUPER_SECRET_KEY } = process.env;

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const userAgent = req.headers["user-agent"];
    const apiMethod = req.method;

    const { hostUrl, path, method, headers, body, query } = req.body;

    let clientIP: string;
    if (Array.isArray(req.headers["x-forwarded-for"])) {
      clientIP = req.headers["x-forwarded-for"][0];
    } else {
      clientIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    }

    if (
      userAgent?.match(/Mozilla|Chrome|Safari|Edge|Opera/i) &&
      apiMethod === "POST" &&
      req.body.headers["x-moralis-source"] === "Moralis API docs"
    ) {
      const newHeaders = {
        ...headers,
        "X-API-Key": MORALIS_API_KEY,
        Authorization: `Bearer ${MORALIS_API_KEY}`,
        referer: SUPER_SECRET_KEY,
      };

      const response = await fetch(
        [
          hostUrl,
          path,
          qs.stringify(query || {}, { addQueryPrefix: true }),
        ].join(""),
        {
          method,
          headers: newHeaders,
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        const result = await response.json();

        // Try to store the API usage data and catch any errors
        try {
          await prisma.apiUsage.create({
            data: {
              userAgent,
              method: apiMethod,
              hostUrl,
              path,
              clientIP,
            },
          });
        } catch (dbError) {
          console.error("Error writing to the database: ", dbError);
        }

        res.status(response.status).send(result);
      } else {
        const error = await response.text();

        // Try to store the API usage data and catch any errors
        try {
          await prisma.apiUsage.create({
            data: {
              userAgent,
              method: apiMethod,
              hostUrl,
              path,
              clientIP,
            },
          });
        } catch (dbError) {
          console.error("Error writing to the database: ", dbError);
        }

        res.status(response.status).send(error);
      }
    } else {
      res.status(401).send({ message: "Invalid Key" });
    }
  } catch (error) {
    res.status(500).send(error);
  } finally {
    try {
      await prisma.$disconnect();
    } catch (dbDisconnectError) {
      console.error(
        "Error disconnecting from the database: ",
        dbDisconnectError
      );
    }
  }
}
