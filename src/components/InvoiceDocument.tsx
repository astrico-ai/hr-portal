import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { InvoiceData } from '../lib/invoiceData';
import { SIGNATURE_STAMP } from '../lib/invoiceAssets';

// Indian-grouped money. Uses "Rs." (not ₹) so the built-in Helvetica font
// renders reliably — swap to ₹ only with a registered Unicode font.
const money = (n: number) =>
  'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const B = '#000';
const s = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica', color: B, flexDirection: 'column' },
  title: { textAlign: 'center', fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  box: { borderWidth: 1, borderColor: B },
  row: { flexDirection: 'row' },
  // top header
  sellerCol: { width: '55%', padding: 5, borderRightWidth: 1, borderColor: B },
  metaCol: { width: '45%' },
  metaRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B },
  metaCell: { flex: 1, padding: 3, minHeight: 22 },
  metaCellBorder: { borderRightWidth: 1, borderColor: B },
  label: { fontSize: 6.5, color: '#333' },
  value: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 1 },
  bold: { fontFamily: 'Helvetica-Bold' },
  sellerName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  // parties
  party: { width: '50%', padding: 5 },
  partyDivider: { borderRightWidth: 1, borderColor: B },
  sectionTop: { borderTopWidth: 1, borderColor: B },
  // items table
  th: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: B, backgroundColor: '#f3f4f6' },
  thc: { padding: 3, fontFamily: 'Helvetica-Bold', fontSize: 7.5, borderRightWidth: 1, borderColor: B },
  tc: { padding: 3, borderRightWidth: 1, borderColor: B },
  cSl: { width: '6%', textAlign: 'center' },
  cDesc: { width: '40%' },
  cHsn: { width: '12%', textAlign: 'center' },
  cQty: { width: '11%', textAlign: 'right' },
  cRate: { width: '12%', textAlign: 'right' },
  cPer: { width: '7%', textAlign: 'center' },
  cAmt: { width: '12%', textAlign: 'right' },
  italic: { fontFamily: 'Helvetica-Oblique', fontSize: 7.5, marginTop: 1 },
  // generic full-width bordered band
  band: { borderTopWidth: 1, borderColor: B, padding: 5 },
  spaceBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { textAlign: 'center', marginTop: 6, fontSize: 8 },
  // signature stamp above the "Authorized by" block (right cell)
  stampImg: { width: 46, height: 46, marginTop: 8, alignSelf: 'flex-end' },
  stampDate: { fontSize: 6.5, color: '#333', textAlign: 'right' },
});

const InvoiceDocument: React.FC<{ data: InvoiceData }> = ({ data }) => {
  const taxRows: { label: string; rate?: string; amount: number }[] = [];
  if (data.isExport) {
    // no tax
  } else if (data.intrastate) {
    taxRows.push({ label: 'CGST', rate: `${data.taxRate} %`, amount: data.cgst });
    taxRows.push({ label: 'SGST', rate: `${data.taxRate} %`, amount: data.sgst });
  } else {
    taxRows.push({ label: 'IGST', rate: `${data.taxRate} %`, amount: data.igst });
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Tax Invoice</Text>

        <View style={s.box}>
          {/* Header: seller + invoice meta */}
          <View style={s.row}>
            <View style={s.sellerCol}>
              <Text style={s.sellerName}>{data.seller.name}</Text>
              {data.seller.addressLines.map((l, i) => (
                <Text key={i}>{l}</Text>
              ))}
              <Text>GSTIN/UIN: {data.seller.gstin}</Text>
              <Text>State Name : {data.seller.stateName}, Code : {data.seller.stateCode}</Text>
              <Text>CIN: {data.seller.cin}</Text>
            </View>
            <View style={s.metaCol}>
              <View style={s.metaRow}>
                <View style={[s.metaCell, s.metaCellBorder]}>
                  <Text style={s.label}>Invoice No.</Text>
                  <Text style={s.value}>{data.invoiceNo}</Text>
                </View>
                <View style={s.metaCell}>
                  <Text style={s.label}>Dated</Text>
                  <Text style={s.value}>{data.invoiceDate}</Text>
                </View>
              </View>
              <View style={s.metaRow}>
                <View style={[s.metaCell, s.metaCellBorder]}><Text style={s.label}>Delivery Note</Text></View>
                <View style={s.metaCell}><Text style={s.label}>Mode/Terms of Payment</Text></View>
              </View>
              <View style={s.metaRow}>
                <View style={[s.metaCell, s.metaCellBorder]}><Text style={s.label}>Reference No. & Date.</Text></View>
                <View style={s.metaCell}><Text style={s.label}>Other References</Text></View>
              </View>
              <View style={s.metaRow}>
                <View style={[s.metaCell, s.metaCellBorder]}>
                  <Text style={s.label}>Buyer's Order No.</Text>
                  {!!data.buyerOrderNo && <Text style={s.value}>{data.buyerOrderNo}</Text>}
                </View>
                <View style={s.metaCell}><Text style={s.label}>Dated</Text></View>
              </View>
              <View style={[s.metaRow, { borderBottomWidth: 0 }]}>
                <View style={[s.metaCell, s.metaCellBorder]}><Text style={s.label}>Dispatched through</Text></View>
                <View style={s.metaCell}><Text style={s.label}>Destination</Text></View>
              </View>
            </View>
          </View>

          {/* Consignee + Buyer */}
          <View style={[s.row, s.sectionTop]}>
            <View style={[s.party, s.partyDivider]}>
              <Text style={s.label}>Consignee (Ship to)</Text>
              <Text style={s.bold}>{data.buyer.name}</Text>
              {!!data.buyer.address && <Text>{data.buyer.address}</Text>}
              {!!data.buyer.gstin && <Text>GSTIN/UIN : {data.buyer.gstin}</Text>}
              {!!data.buyer.stateName && (
                <Text>State Name : {data.buyer.stateName}{data.buyer.stateCode ? `, Code : ${data.buyer.stateCode}` : ''}</Text>
              )}
            </View>
            <View style={s.party}>
              <Text style={s.label}>Buyer (Bill to)</Text>
              <Text style={s.bold}>{data.buyer.name}</Text>
              {!!data.buyer.address && <Text>{data.buyer.address}</Text>}
              {!!data.buyer.gstin && <Text>GSTIN/UIN : {data.buyer.gstin}</Text>}
              {!!data.buyer.stateName && (
                <Text>State Name : {data.buyer.stateName}{data.buyer.stateCode ? `, Code : ${data.buyer.stateCode}` : ''}</Text>
              )}
            </View>
          </View>

          {/* Line items */}
          <View style={s.th}>
            <Text style={[s.thc, s.cSl]}>Sl No.</Text>
            <Text style={[s.thc, s.cDesc]}>Description of Services</Text>
            <Text style={[s.thc, s.cHsn]}>HSN/SAC</Text>
            <Text style={[s.thc, s.cQty]}>Quantity</Text>
            <Text style={[s.thc, s.cRate]}>Rate</Text>
            <Text style={[s.thc, s.cPer]}>per</Text>
            <Text style={[s.thc, s.cAmt, { borderRightWidth: 0 }]}>Amount</Text>
          </View>

          {data.lines.map((ln, idx) => (
            <View style={s.row} key={idx}>
              <Text style={[s.tc, s.cSl]}>{idx + 1}</Text>
              <View style={[s.tc, s.cDesc]}>
                <Text style={s.bold}>{ln.description}</Text>
                {!!ln.subDescription && <Text style={s.italic}>{ln.subDescription}</Text>}
              </View>
              <Text style={[s.tc, s.cHsn]}>{ln.hsn}</Text>
              <Text style={[s.tc, s.cQty]}>{ln.quantity ? `${plain(ln.quantity)}${ln.unit ? ' ' + ln.unit : ''}` : ' '}</Text>
              <Text style={[s.tc, s.cRate]}>{ln.rate ? plain(ln.rate) : ' '}</Text>
              <Text style={[s.tc, s.cPer]}>{ln.quantity && ln.rate ? (ln.unit || '') : ' '}</Text>
              <Text style={[s.tc, s.cAmt, { borderRightWidth: 0 }]}>{plain(ln.amount)}</Text>
            </View>
          ))}

          {/* Filler row — a small cushion under the line items. Height is fixed, so
              the invoice grows naturally with the number of line items instead of
              stretching to fill the whole page. */}
          <View style={[s.row, { minHeight: 48 }]}>
            <Text style={[s.tc, s.cSl]}> </Text>
            <Text style={[s.tc, s.cDesc]}> </Text>
            <Text style={[s.tc, s.cHsn]}> </Text>
            <Text style={[s.tc, s.cQty]}> </Text>
            <Text style={[s.tc, s.cRate]}> </Text>
            <Text style={[s.tc, s.cPer]}> </Text>
            <Text style={[s.tc, s.cAmt, { borderRightWidth: 0 }]}> </Text>
          </View>

          {taxRows.map((t, i) => (
            <View style={s.row} key={i}>
              <Text style={[s.tc, s.cSl]}> </Text>
              <Text style={[s.tc, s.cDesc, s.bold, { textAlign: 'right' }]}>{t.label}</Text>
              <Text style={[s.tc, s.cHsn]}> </Text>
              <Text style={[s.tc, s.cQty]}> </Text>
              <Text style={[s.tc, s.cRate]}>{t.rate}</Text>
              <Text style={[s.tc, s.cPer]}>%</Text>
              <Text style={[s.tc, s.cAmt, { borderRightWidth: 0 }]}>{plain(t.amount)}</Text>
            </View>
          ))}

          {data.roundOff !== 0 && (
            <View style={s.row}>
              <Text style={[s.tc, s.cSl]}> </Text>
              <Text style={[s.tc, s.cDesc, s.italic, { textAlign: 'right' }]}>Less : R/OFF (Sales)</Text>
              <Text style={[s.tc, s.cHsn]}> </Text>
              <Text style={[s.tc, s.cQty]}> </Text>
              <Text style={[s.tc, s.cRate]}> </Text>
              <Text style={[s.tc, s.cPer]}> </Text>
              <Text style={[s.tc, s.cAmt, { borderRightWidth: 0 }]}>{plain(data.roundOff)}</Text>
            </View>
          )}

          {/* Total */}
          <View style={[s.row, { borderTopWidth: 1, borderColor: B }]}>
            <Text style={[s.tc, s.cSl]}> </Text>
            <Text style={[s.tc, s.cDesc, s.bold, { textAlign: 'right' }]}>Total</Text>
            <Text style={[s.tc, s.cHsn]}> </Text>
            <Text style={[s.tc, s.cQty]}> </Text>
            <Text style={[s.tc, s.cRate]}> </Text>
            <Text style={[s.tc, s.cPer]}> </Text>
            <Text style={[s.tc, s.cAmt, s.bold, { borderRightWidth: 0 }]}>{money(data.total)}</Text>
          </View>

          {/* Amount in words */}
          <View style={s.band}>
            <View style={s.spaceBetween}>
              <Text style={s.label}>Amount Chargeable (in words)</Text>
              <Text style={s.label}>E. &amp; O.E</Text>
            </View>
            <Text style={[s.bold, { marginTop: 2 }]}>{data.amountInWords}</Text>
          </View>

          {/* HSN / tax summary */}
          <View style={[s.th, { backgroundColor: '#fff' }]}>
            <Text style={[s.thc, { width: '40%' }]}>HSN/SAC</Text>
            <Text style={[s.thc, { width: '15%', textAlign: 'right' }]}>Taxable Value</Text>
            {data.isExport ? null : data.intrastate ? (
              <>
                <Text style={[s.thc, { width: '15%', textAlign: 'center' }]}>CGST</Text>
                <Text style={[s.thc, { width: '15%', textAlign: 'center' }]}>SGST/UTGST</Text>
                <Text style={[s.thc, { width: '15%', textAlign: 'right', borderRightWidth: 0 }]}>Total Tax</Text>
              </>
            ) : (
              <>
                <Text style={[s.thc, { width: '30%', textAlign: 'center' }]}>IGST</Text>
                <Text style={[s.thc, { width: '15%', textAlign: 'right', borderRightWidth: 0 }]}>Total Tax</Text>
              </>
            )}
          </View>
          <View style={s.row}>
            <Text style={[s.tc, { width: '40%' }]}>{data.lines[0]?.hsn}</Text>
            <Text style={[s.tc, { width: '15%', textAlign: 'right' }]}>{plain(data.taxable)}</Text>
            {data.isExport ? null : data.intrastate ? (
              <>
                <Text style={[s.tc, { width: '15%', textAlign: 'center' }]}>{data.taxRate}%  {plain(data.cgst)}</Text>
                <Text style={[s.tc, { width: '15%', textAlign: 'center' }]}>{data.taxRate}%  {plain(data.sgst)}</Text>
                <Text style={[s.tc, { width: '15%', textAlign: 'right', borderRightWidth: 0 }]}>{plain(data.taxAmount)}</Text>
              </>
            ) : (
              <>
                <Text style={[s.tc, { width: '30%', textAlign: 'center' }]}>{data.taxRate}%   {plain(data.igst)}</Text>
                <Text style={[s.tc, { width: '15%', textAlign: 'right', borderRightWidth: 0 }]}>{plain(data.taxAmount)}</Text>
              </>
            )}
          </View>

          {/* Tax in words + PAN */}
          <View style={s.band}>
            <Text>Tax Amount (in words) : <Text style={s.bold}>{data.taxAmountInWords}</Text></Text>
            <Text style={{ marginTop: 2 }}>Company's PAN : <Text style={s.bold}>{data.seller.pan}</Text></Text>
          </View>

          {/* Rule 46 — reverse charge declaration (below the tax summary) */}
          <View style={{ paddingVertical: 3, paddingHorizontal: 5, borderTopWidth: 1, borderColor: B }}>
            <Text style={{ fontSize: 7.5 }}>
              Whether tax is payable under reverse charge : <Text style={s.bold}>No</Text>
            </Text>
          </View>

          {/* Declaration + Bank */}
          <View style={[s.row, s.sectionTop]}>
            <View style={[s.party, s.partyDivider]}>
              <Text style={s.bold}>Declaration</Text>
              <Text style={{ marginTop: 2 }}>
                We declare that this invoice shows the actual price of the goods described and that all
                particulars are true and correct.
              </Text>
            </View>
            <View style={s.party}>
              <Text style={s.bold}>Company's Bank Details</Text>
              <Text style={{ marginTop: 2 }}>A/c Holder's Name : {data.bank.accountHolder}</Text>
              <Text>Bank Name : {data.bank.bankName}</Text>
              <Text>A/c No. : {data.bank.accountNo}</Text>
              <Text>Branch & IFS Code : {data.bank.branchAndIfsc}</Text>
              <Text style={[s.bold, { marginTop: 10, textAlign: 'right' }]}>for {data.seller.name}</Text>
              {/* Signature stamp */}
              <Image style={s.stampImg} src={SIGNATURE_STAMP} />
              <Text style={{ textAlign: 'right' }}>Signed by Vraj Sheth,</Text>
              {!!data.signedOn && <Text style={s.stampDate}>Date: {data.signedOn}</Text>}
              <Text style={{ textAlign: 'right' }}>CEO, NV360 Technology Private Limited</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer}>This is a Computer Generated Invoice</Text>
      </Page>
    </Document>
  );
};

export default InvoiceDocument;
