import { shipmentCreateInput, shipmentInput } from '@shupit/contracts';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { NotFoundError, createShipment, deleteShipment, updateShipment } from './_lib/ordersService';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

const idParam = (request: Request) => {
  const id = new URL(request.url).searchParams.get('id');
  return id && id.length <= 128 && !id.includes('/') ? id : null;
};

/** POST → add a shipment to one of the caller's orders. */
export const POST = withAuth(async (request, user) => {
  const parsed = shipmentCreateInput.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'validation', 'Invalid shipment');
  try {
    const id = await createShipment(adminDb(), user.uid, parsed.data);
    return json({ id }, 201, {}, request);
  } catch (e) {
    if (e instanceof NotFoundError) return errorResponse(404, 'not_found', 'Order not found');
    throw e;
  }
});

/** PUT ?id= → edit a shipment (tracking history is preserved). */
export const PUT = withAuth(async (request, user) => {
  const id = idParam(request);
  if (!id) return errorResponse(400, 'bad_request', 'Missing id');
  const parsed = shipmentInput.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'validation', 'Invalid shipment');
  try {
    await updateShipment(adminDb(), user.uid, id, parsed.data);
    return json({ ok: true }, 200, {}, request);
  } catch (e) {
    if (e instanceof NotFoundError) return errorResponse(404, 'not_found', 'Shipment not found');
    throw e;
  }
});

/** DELETE ?id= → remove a shipment and its events. */
export const DELETE = withAuth(async (request, user) => {
  const id = idParam(request);
  if (!id) return errorResponse(400, 'bad_request', 'Missing id');
  try {
    await deleteShipment(adminDb(), user.uid, id);
    return json({ ok: true }, 200, {}, request);
  } catch (e) {
    if (e instanceof NotFoundError) return errorResponse(404, 'not_found', 'Shipment not found');
    throw e;
  }
});
