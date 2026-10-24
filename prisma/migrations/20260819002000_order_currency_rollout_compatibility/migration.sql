-- Keep order creation compatible during rolling deployments. Older app
-- versions do not know the new required display-snapshot columns, so fill an
-- omitted snapshot from the canonical BDT values. New versions provide every
-- display value explicitly and are left unchanged by these COALESCE guards.
CREATE FUNCTION "fillOrderCurrencySnapshotDefaults"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."baseCurrency" := COALESCE(NEW."baseCurrency", 'BDT');
  NEW."displayCurrency" := COALESCE(NEW."displayCurrency", 'BDT');
  NEW."displaySubtotal" := COALESCE(NEW."displaySubtotal", NEW."subtotal");
  NEW."displayDeliveryCharge" := COALESCE(
    NEW."displayDeliveryCharge",
    NEW."deliveryCharge"
  );
  NEW."displayDiscountAmount" := COALESCE(
    NEW."displayDiscountAmount",
    NEW."discountAmount"
  );
  NEW."displayTaxAmount" := COALESCE(NEW."displayTaxAmount", NEW."taxAmount");
  NEW."displayTotalAmount" := COALESCE(
    NEW."displayTotalAmount",
    NEW."totalAmount"
  );
  NEW."displayAdvancePayment" := COALESCE(
    NEW."displayAdvancePayment",
    NEW."advancePayment"
  );
  NEW."exchangeRate" := COALESCE(NEW."exchangeRate", 1);
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Order_currency_snapshot_defaults"
BEFORE INSERT ON "Order"
FOR EACH ROW
EXECUTE FUNCTION "fillOrderCurrencySnapshotDefaults"();

CREATE FUNCTION "fillOrderItemCurrencySnapshotDefaults"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."displayUnitPrice" := COALESCE(
    NEW."displayUnitPrice",
    NEW."unitPrice"
  );
  NEW."displayTotalPrice" := COALESCE(
    NEW."displayTotalPrice",
    NEW."totalPrice"
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "OrderItem_currency_snapshot_defaults"
BEFORE INSERT ON "OrderItem"
FOR EACH ROW
EXECUTE FUNCTION "fillOrderItemCurrencySnapshotDefaults"();
