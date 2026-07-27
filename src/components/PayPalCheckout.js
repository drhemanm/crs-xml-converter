import React, { useEffect, useRef } from 'react';

// Hoisted out of the component so it is a stable reference: rebuilding it on
// every render made it a changing effect dependency.
//
// NOTE: these amounts do not match the plans advertised in CRSXMLConverter.js
// (Professional $79, Enterprise $299), and they are one-time order amounts
// rather than subscriptions. See AUDIT.md finding C5 — this component is also
// not rendered anywhere. Left as-is pending the pricing decision; this change
// is lint-only and alters no behaviour.
const planPrices = {
  professional: '29.00',
  enterprise: '99.00'
};

const PayPalCheckout = ({ plan, onSuccess, onError, onCancel }) => {
  const paypalRef = useRef();

  useEffect(() => {
    if (window.paypal) {
      window.paypal.Buttons({
        createOrder: (data, actions) => {
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: planPrices[plan],
                currency_code: 'USD'
              },
              description: `CRS XML Converter - ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
              custom_id: `plan_${plan}_${Date.now()}`
            }],
            application_context: {
              brand_name: 'Evologics CRS Converter',
              user_action: 'PAY_NOW'
            }
          });
        },
        onApprove: async (data, actions) => {
          try {
            const order = await actions.order.capture();
            console.log('✅ PayPal payment successful:', order);
            onSuccess(order, plan);
          } catch (error) {
            console.error('❌ PayPal capture error:', error);
            onError(error);
          }
        },
        onError: (err) => {
          console.error('❌ PayPal error:', err);
          onError(err);
        },
        onCancel: (data) => {
          console.log('⚠️ PayPal payment cancelled:', data);
          onCancel();
        },
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal'
        }
      }).render(paypalRef.current);
    }
  }, [plan, onSuccess, onError, onCancel]);

  return (
    <div>
      <div ref={paypalRef}></div>
    </div>
  );
};

export default PayPalCheckout;
