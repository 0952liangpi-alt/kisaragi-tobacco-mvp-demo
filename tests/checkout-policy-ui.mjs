import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import vm from 'node:vm';

const source = readFileSync(new URL('../checkout.js', import.meta.url), 'utf8');
const boot = "  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);\n  else init();";
assert.ok(source.includes(boot), 'checkout boot marker must remain stable for the focused policy test');
const instrumented = source.replace(boot, '  globalThis.__KISARAGI_CHECKOUT_TEST__ = {normalizeCheckoutOptions, deliveryDates, shippingFee};');
const context = vm.createContext({globalThis:{}, Intl, Date, Number, String, Object, Array});
vm.runInContext(instrumented, context);
const helpers = context.globalThis.__KISARAGI_CHECKOUT_TEST__;

const options = helpers.normalizeCheckoutOptions({
  currency:'JPY',
  services:[
    {id:'carrier-a', label:'Carrier A', feeJpy:800, freeShippingThresholdJpy:15000},
    {id:'carrier-b', label:'Carrier B', feeJpy:750, freeShippingThresholdJpy:null},
  ],
  deliveryPolicy:{
    timeZone:'Asia/Tokyo', minDays:3, maxDays:10,
    timeSlots:[{id:'morning', label:'午前中'}, {id:'18-20', label:'18:00 - 20:00'}],
    faceToFaceDelivery:true, ageVerificationRequired:true, leaveAtDoorAllowed:false,
  },
});
assert.ok(options, 'a complete protected checkout policy must be accepted');
assert.equal(options.services.length, 2);
assert.equal(helpers.shippingFee(options.services[0], 14999), 800, 'configured fee applies below the approved threshold');
assert.equal(helpers.shippingFee(options.services[0], 15000), 0, 'configured threshold applies at the approved amount');
assert.equal(helpers.shippingFee(options.services[1], 99999), 750, 'no threshold means the fee is never silently waived');

const dates = helpers.deliveryDates(options.deliveryPolicy, new Date('2026-09-22T03:00:00Z'));
assert.equal(dates.length, 8, 'policy window 3 through 10 must produce eight selectable dates');
assert.deepEqual({...dates[0]}, {value:'2026-09-25', label:'2026年09月25日 (金)'});
assert.deepEqual({...dates.at(-1)}, {value:'2026-10-02', label:'2026年10月02日 (金)'});

assert.equal(helpers.normalizeCheckoutOptions({
  currency:'USD', services:options.services, deliveryPolicy:options.deliveryPolicy,
}), null, 'non-JPY options must fail closed');
assert.equal(helpers.normalizeCheckoutOptions({
  currency:'JPY', services:options.services, deliveryPolicy:{...options.deliveryPolicy, timeZone:'UTC'},
}), null, 'non-JST policy must fail closed');

console.log('Checkout policy UI: PASS (protected service rules, JST 3-10 day options, configured-only free shipping)');
