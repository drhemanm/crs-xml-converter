import { createPaymentHandler } from "../_shared/payment-service.ts";

Deno.serve(createPaymentHandler(Deno.env.toObject()));
