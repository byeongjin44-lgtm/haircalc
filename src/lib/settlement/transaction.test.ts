import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTransactionSnapshot, calculateSettlement, createDefaultSettlementSettings } from "./engine.ts";
import { transactionPayout } from "./transaction.ts";
import { createMemoryStore } from "./recordStore.memory.ts";
import { deleteTransactionFromStore, deletePrepaidPassFromStore, deleteMembershipPassFromStore } from "./storage.ts";
import { summarizeTransactions } from "./summary.ts";
import type { Transaction, PrepaidEvent, MembershipEvent } from "./types.ts";
const now="2026-10-07T00:00:00.000Z";
const input={id:"tx",date:"2026-10-07",amount:100000,customerType:"OTHER" as const,serviceType:"CUT" as const,paymentType:"CASH" as const,createdAt:now,updatedAt:now};
function transaction(on=true) { return buildTransactionSnapshot(input,createDefaultSettlementSettings({withholding3_3:on})); }
test("A. OFF keeps 40000 payout",()=>assert.equal(transactionPayout(transaction(false)),40000));
test("B. ON yields 38680 in summary",()=>assert.equal(summarizeTransactions([transaction()]).totalSettlementAmount,38680));
test("C. saved final payout equals preview net",async()=>{
 const store=createMemoryStore();const tx=transaction();await store.put("transactions",tx);
 const saved=await store.get<Transaction>("transactions","tx");
 assert.equal(transactionPayout(saved!),calculateSettlement(100000,"OTHER","CASH",createDefaultSettlementSettings({withholding3_3:true})).estimatedPayoutAmount);
 assert.equal(saved!.settlementAmount,40000);
});
test("D. settings mutations cannot change saved rules or payouts",()=>{
 const settings=createDefaultSettlementSettings({withholding3_3:true,customerTypeRates:{NEW:0.35}});
 const tx=buildTransactionSnapshot(input,settings);settings.baseIncentiveRate=.9;settings.withholding3_3=false;settings.customerTypeRates.NEW=.9;
 assert.equal(transactionPayout(tx),38680);
 assert.equal(tx.settlementSettingsSnapshot!.baseIncentiveRate,.4);
 assert.equal(tx.settlementSettingsSnapshot!.withholding3_3,true);
 assert.equal(tx.settlementSettingsSnapshot!.customerTypeRates.NEW,.35);
});

test("F/G. delete affects only transaction and removes summary impact",async()=>{
 const store=createMemoryStore();await store.put("transactions",transaction());await store.put("transactions",{...transaction(false),id:"keep"});
 await store.put("prepaidEvents",{id:"event",salesImpact:100});await store.put("membershipEvents",{id:"membership"});
 await deleteTransactionFromStore(store,"tx");
 assert.equal(summarizeTransactions(await store.getAll<Transaction>("transactions")).totalSettlementAmount,40000);
 assert.equal((await store.getAll("prepaidEvents")).length,1);assert.equal((await store.getAll("membershipEvents")).length,1);
});


test("legacy summary reads net without mutating original",()=>{
 const tx=transaction();delete tx.settlementSettingsSnapshot;const before=JSON.stringify(tx);
 assert.equal(summarizeTransactions([tx]).totalSettlementAmount,38680);assert.equal(JSON.stringify(tx),before);
});

for (const kind of ["prepaid","membership"] as const) {
 const erase=kind==="prepaid"?deletePrepaidPassFromStore:deleteMembershipPassFromStore;
 const eventStore=kind==="prepaid"?"prepaidEvents":"membershipEvents";
 const passStore=kind==="prepaid"?"prepaidPasses":"membershipPasses";
 const key=kind==="prepaid"?"prepaidPassId":"membershipPassId";
 test(kind+" unused purchase-only deletion",async()=>{
  const store=createMemoryStore();await store.put(passStore,{id:"pass"});await store.put(eventStore,{id:"purchase",[key]:"pass",type:"PURCHASE"});
  await erase(store,"pass");assert.deepEqual(await store.getAll(passStore),[]);assert.deepEqual(await store.getAll(eventStore),[]);
 });
 const types: (PrepaidEvent["type"] | MembershipEvent["type"])[]=kind==="prepaid"?["USE","OTHER_DESIGNER_USE","REFUND","ADJUSTMENT"]:["USE","OTHER_DESIGNER_USE","ADJUSTMENT"];
 for(const type of types) test(kind+" blocks "+type+" without writes",async()=>{
  const store=createMemoryStore();await store.put(passStore,{id:"pass"});await store.put(eventStore,{id:"purchase",[key]:"pass",type:"PURCHASE"});await store.put(eventStore,{id:"event",[key]:"pass",type});
  const before=await store.getAll(eventStore);
  await assert.rejects(()=>erase(store,"pass"),/정산 기록/);
  assert.deepEqual(await store.getAll(eventStore),before);assert.equal((await store.getAll(passStore)).length,1);
 });
}
