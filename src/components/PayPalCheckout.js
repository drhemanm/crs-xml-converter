import React, { useEffect, useRef } from 'react';

const PayPalCheckout = ({ plan, onSuccess, onError, onCancel }) => {
  const paypalRef = useRef();

  const planPrices = {
    professional: '29.00',
    enterprise: '99.00'
  };

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
              brand_name: 'iAfrica CRS Converter',
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
