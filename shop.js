(() => {
  const $ = (selector) => document.querySelector(selector);
  const pageSize = 24;
  const state = {group:'all', category:'all', brand:'all', device:'all', sort:'source', query:'', cart:[], visibleCount:pageSize};
  const commerce = () => globalThis.KISARAGI_COMMERCE;
  const live = () => globalThis.KISARAGI_COMMERCE_LIVE;
  const catalogAuthorityConfigured = () => Boolean(globalThis.KISARAGI_LIVE_CONFIG?.apiBase);
  const catalogAuthorityReady = () => !catalogAuthorityConfigured() || globalThis.KISARAGI_LIVE_STATUS === 'LIVE';
  const currentPrice = (item) => item.price_jpy ?? item.price ?? null;
  const isOpenPrice = (item) => String(item.official_catalog_price_kind || item.official_catalog_price_type || '').toUpperCase() === 'OPEN_PRICE' ||
    String(item.official_catalog_price_text || '').includes('オープン価格');
  const staticDisplayAmount = (item) => {
    const raw = currentPrice(item) ?? item.official_catalog_price_jpy;
    const amount = raw == null ? null : Number(raw);
    return Number.isInteger(amount) && amount > 0 ? amount : null;
  };
  const approvedCatalogPrice = (item) => {
    if (!catalogAuthorityConfigured()) return !isOpenPrice(item) && staticDisplayAmount(item) !== null;
    return catalogAuthorityReady() && typeof item.approved_sale_price_id === 'string' &&
      typeof item.approved_sale_price_version === 'string' &&
      item.approved_sale_price_version.startsWith(`${item.approved_sale_price_id}:`) &&
      Number.isInteger(Number(currentPrice(item))) && Number(currentPrice(item)) > 0;
  };
  const liveCart = {connected:false, capabilities:null, session:null, userId:null};
  let cartMutationQueue = Promise.resolve();
  const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const officialPriceKindLabel = (kind) => ({
    MANUFACTURER_LIST_PRICE_TAX_INCLUDED:'メーカー定価',
    MANUFACTURER_LIST_PRICE_TAX_INCLUSIVE:'メーカー定価',
    MANUFACTURER_LIST_PRICE:'メーカー定価',
    FIXED_LIST_PRICE:'定価',
    CATALOG_RETAIL_PRICE:'カタログ掲載小売価格',
    CATALOG_PRICE:'カタログ掲載価格',
    CATALOG_LISTED_PRICE:'カタログ掲載価格',
    SUGGESTED_RETAIL_PRICE_TAX_INCLUDED:'希望小売価格',
    SUGGESTED_RETAIL_PRICE_TAX_INCLUSIVE:'希望小売価格',
    SUGGESTED_RETAIL_PRICE:'希望小売価格',
    OPEN_PRICE:'オープン価格',
  })[String(kind || '').toUpperCase()] || '公式カタログ価格';
  const officialPrice = (item) => {
    const rawAmount = item.official_catalog_price_jpy;
    const amount = rawAmount != null && Number.isFinite(Number(rawAmount)) ? Number(rawAmount) : null;
    const kind = String(item.official_catalog_price_kind || item.official_catalog_price_type || '').toUpperCase();
    const open = kind === 'OPEN_PRICE' || String(item.official_catalog_price_text || '').includes('オープン価格');
    return {amount, open, kind, kindLabel:officialPriceKindLabel(kind)};
  };
  const officialPricePeriod = (item) => [
    item.official_catalog_price_valid_from || item.official_catalog_price_effective_from,
    item.official_catalog_price_valid_until || item.official_catalog_price_effective_to,
  ].filter(Boolean).join(' ～ ');
  const publicPrice = (item) => {
    const official = officialPrice(item);
    const openPrice = () => ({amount:null, text:'オープン価格', label:official.kindLabel, note:'販売価格確定後にカートへ追加できます'});
    if (catalogAuthorityConfigured() && !catalogAuthorityReady()) {
      return official.open ? openPrice() : {amount:null, text:'販売価格確認中', label:'販売価格サービス未接続', note:'商品情報は閲覧できます'};
    }
    const adminAmount = currentPrice(item);
    if (catalogAuthorityConfigured() && approvedCatalogPrice(item)) {
      return {amount:Number(adminAmount), text:yen(adminAmount), label:'表示価格', note:'価格は変更される場合があります'};
    }
    if (official.open) return openPrice();
    if (catalogAuthorityConfigured()) {
      return {amount:null, text:'販売価格未承認', label:'販売価格を確認できません', note:'承認後にカートへ追加できます'};
    }
    if (adminAmount != null) return {amount:Number(adminAmount), text:yen(adminAmount), label:'表示価格', note:'価格は変更される場合があります'};
    const tax = item.official_catalog_price_tax_included === true ? '税込' : item.official_catalog_price_tax_included === false ? '税別' : '税区分記載なし';
    const date = item.official_catalog_price_as_of || officialPricePeriod(item);
    if (official.amount != null) return {amount:official.amount, text:yen(official.amount), label:`${official.kindLabel}（${tax}）`, note:date ? `${date}時点` : '公式資料掲載価格'};
    return {amount:null, text:'価格は店頭でご確認ください', label:'価格情報なし', note:'商品情報のみ掲載しています'};
  };
  globalThis.KISARAGI_CATALOG_PRICING = Object.freeze({approvedCatalogPrice, publicPrice});
  const cartUnitPrice = (line) => line.server
    ? (Number.isInteger(line.server.unitPriceJpy) ? line.server.unitPriceJpy : null)
    : publicPrice(line.item).amount;
  const linePriceText = (line) => cartUnitPrice(line) == null ? '価格情報なし' : yen(cartUnitPrice(line) * line.quantity);
  const cartTotalText = () => {
    const knownTotal = state.cart.reduce((sum, line) => sum + ((cartUnitPrice(line) ?? 0) * line.quantity), 0);
    return state.cart.some((line) => cartUnitPrice(line) == null)
      ? `${knownTotal ? `${yen(knownTotal)} + ` : ''}価格情報なし`
      : yen(knownTotal);
  };
  const catalog = () => (globalThis.KISARAGI_CANONICAL_CATALOG || []).filter((item) => item.status !== 'PRICE_CONFLICT');
  const imageFor = (item) => {
    const asset = item.images?.[0] || item.image;
    if (!asset?.file_path) return null;
    const version = /^[a-f0-9]{64}$/i.test(asset.sha256 || '') ? asset.sha256.slice(0, 12) : null;
    return version ? `${asset.file_path}${asset.file_path.includes('?') ? '&' : '?'}v=${version}` : asset.file_path;
  };
  const categoryLabels = {CIGARETTES:'紙巻きたばこ',IMPORTED_CIGARETTES:'輸入紙巻きたばこ',CIGARS:'葉巻たばこ',RYO:'手巻きたばこ',PIPE_TOBACCO:'パイプたばこ',CUT_TOBACCO:'刻みたばこ',HEATED_TOBACCO_STICKS:'加熱式たばこスティック',HEATED_TOBACCO_CAPSULES:'加熱式たばこカプセル',HEATED_TOBACCO_DEVICES:'加熱式たばこデバイス',SMOKELESS_TOBACCO:'無煙たばこ',SMOKING_ACCESSORIES:'喫煙用品',ROLLING_ACCESSORIES:'手巻き喫煙具',PIPE_ACCESSORIES:'パイプ用品',ASHTRAYS:'携帯灰皿',LIGHTERS:'ライター'};
  const readableCategory = (item) => categoryLabels[item.category] || item.category?.replaceAll('_',' ') || '商品';
  const hasPlaceholderIdentity = (item) => item.status==='IDENTITY_PENDING'||/確認待ち/.test(String(item.product_name_ja||item.name||''));
  const customerName = (item) => hasPlaceholderIdentity(item)
    ? `${readableCategory(item)} ${item.product_code||item.sku||'商品'}`
    : item.product_name_ja||item.name||`${readableCategory(item)} ${item.product_code||item.sku||''}`.trim();
  const customerBrand = (item) => item.brand&&item.brand!=='UNKNOWN'?item.brand:'ブランド情報なし';
  const categoryGroups = {
    cigarettes: ['CIGARETTES', 'IMPORTED_CIGARETTES'],
    heated: ['HEATED_TOBACCO_STICKS', 'HEATED_TOBACCO_CAPSULES', 'HEATED_TOBACCO_DEVICES'],
    rolling: ['CIGARS', 'RYO', 'PIPE_TOBACCO', 'CUT_TOBACCO', 'SMOKELESS_TOBACCO'],
    goods: ['SMOKING_ACCESSORIES', 'ROLLING_ACCESSORIES', 'PIPE_ACCESSORIES', 'ASHTRAYS', 'LIGHTERS'],
  };
  const groupLabels = {all:'すべて', cigarettes:'紙巻きたばこ', heated:'加熱式たばこ', rolling:'葉巻・手巻き', goods:'喫煙具'};
  const groupFor = (category) => Object.keys(categoryGroups).find((group) => categoryGroups[group].includes(category)) || 'rolling';
  const normalize = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g, '');
  const matchesQuery = (item, rawQuery) => {
    const query = normalize(rawQuery);
    if (!query) return true;
    return [item.brand, item.product_name_ja, item.sku, item.product_code, item.system_code]
      .filter((value) => value != null && value !== '')
      .some((value) => normalize(value).includes(query));
  };
  globalThis.KISARAGI_CATALOG_SEARCH = Object.freeze({matchesQuery});
  const collator = new Intl.Collator('ja', {numeric:true, sensitivity:'base'});
  const deviceFor = (item) => {
    if (!['HEATED_TOBACCO_STICKS', 'HEATED_TOBACCO_CAPSULES'].includes(item.category)) return null;
    const name = normalize(item.product_name_ja);
    if (name.includes('iqosiluma') || name.includes('イルマ用')) return 'IQOS ILUMA';
    if (name.includes('プルーム用')) return 'Ploom';
    if (name.includes('ウィズ用')) return 'with';
    if (name.includes('glohyper用') || name.includes('hyper用')) return 'glo HYPER';
    if (name.includes('glohilo用') || name.includes('hilo用')) return 'glo Hilo';
    return null;
  };
  const visibleCatalog = () => catalog().filter((item) => state.group === 'all' || groupFor(item.category) === state.group);
  const setOptions = (select, options, current) => {
    select.replaceChildren(...options.map(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
    select.value = options.some(([value]) => value === current) ? current : options[0][0];
    return select.value;
  };
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');window.setTimeout(()=>el.classList.remove('show'),2200)}
  const safeExternalUrl=(value)=>{try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)?url.href:null}catch{return null}};
  let citationReturnFocus=null;
  let releaseCitationLock=null;
  function updateModalState(){
    const ageOpen=!$('#ageGate').hidden;
    const cartOpen=$('#cartPanel').getAttribute('aria-hidden')==='false';
    const citationOpen=$('#citationModal').getAttribute('aria-hidden')==='false';
    document.body.classList.toggle('has-open-modal',ageOpen||cartOpen||citationOpen);
  }
  function citationRow(label,value){
    const term=document.createElement('dt');
    const detail=document.createElement('dd');
    term.textContent=label;
    detail.textContent=String(value??'未登録');
    const row=document.createElement('div');
    row.className='citation-row';
    row.append(term,detail);
    return row;
  }
  function openCitation(item,trigger){
    const modal=$('#citationModal');
    const sourceRegistry=Object.values(globalThis.KISARAGI_SOURCE_REGISTRY||{});
    const sourceId=(entry)=>entry?.id||entry?.source_id;
    const priceSource=sourceRegistry.find((entry)=>sourceId(entry)===item.official_catalog_price_source_id);
    const imageSource=sourceRegistry.find((entry)=>entry.id===item.image_source)
      ||sourceRegistry.find((entry)=>entry.source_id===item.image_source);
    const source=imageSource||priceSource
      ||sourceRegistry.find((entry)=>entry.url&&(entry.url===item.source_url||entry.url===item.manufacturer_source_url));
    const sourceUrl=safeExternalUrl(priceSource?.url||priceSource?.source_url||item.source_url||item.manufacturer_source_url);
    const official=officialPrice(item);
    const evidenceValue=item.official_catalog_price_evidence;
    const evidenceList=Array.isArray(evidenceValue)?evidenceValue:(evidenceValue?[evidenceValue]:[]);
    const evidence=evidenceList[0];
    const evidencePage=evidence&&typeof evidence==='object'
      ? evidence.source_page??evidence.page??evidence.pdf_page??evidence.catalog_page??item.manufacturer_pdf_page??item.pdf_page
      : item.manufacturer_pdf_page??item.pdf_page;
    const evidenceSummary=evidenceList.map((entry)=>{
      if(!entry||typeof entry!=='object')return null;
      const page=entry.source_page??entry.page??entry.pdf_page??entry.catalog_page;
      return `${entry.source_id||'資料'}${page!=null?` p.${page}`:''}`;
    }).filter(Boolean).join(' / ');
    const evidenceText=typeof evidence==='string' ? evidence : evidence?.text??evidence?.excerpt??null;
    const taxLabel=item.official_catalog_price_tax_included===true?'税込':item.official_catalog_price_tax_included===false?'税別':'税区分記載なし';
    const validity=officialPricePeriod(item);
    const officialPriceText=official.amount!=null?yen(official.amount):official.open?'オープン価格':'未登録';
    $('#citationTitle').textContent=customerName(item);
    const body=$('#citationBody');
    body.replaceChildren(
      citationRow('カテゴリ',readableCategory(item)),
      citationRow('ブランド',customerBrand(item)),
      citationRow('商品コード',item.product_code||item.sku||'未登録'),
      citationRow('内容量',item.pack_size!=null?`${item.pack_size}${item.pack_unit||'本'}`:'未登録'),
      citationRow('Tar',item.tar_mg!=null?`${item.tar_mg}mg`:'未登録'),
      citationRow('Nicotine',item.nicotine_mg!=null?`${item.nicotine_mg}mg`:'未登録'),
      citationRow('対応機種',deviceFor(item)||'該当なし'),
      citationRow('カタログ掲載価格',officialPriceText),
      citationRow('価格区分',`${official.kindLabel} / ${taxLabel}`),
      citationRow('価格基準日',item.official_catalog_price_as_of||'未登録'),
      citationRow('価格有効期間',validity||'未登録'),
      citationRow('出典資料',evidenceSummary||item.official_catalog_price_source_id||sourceId(source)||'商品資料'),
      citationRow('掲載ページ',evidencePage??'未登録'),
      citationRow('画像出典',item.image_source||'商品資料')
    );
    if(evidenceText)body.append(citationRow('価格根拠',evidenceText));
    if(item.notes)body.append(citationRow('補足',item.notes));
    const sourceLink=$('#citationSourceLink');
    sourceLink.hidden=!sourceUrl;
    if(sourceUrl)sourceLink.href=sourceUrl;
    else sourceLink.removeAttribute('href');
    citationReturnFocus=trigger||document.activeElement;
    const background=[...document.body.children].filter((element)=>element!==modal&&element.tagName!=='SCRIPT');
    const previous=background.map((element)=>({element,inert:element.inert,aria:element.getAttribute('aria-hidden')}));
    const overflow=document.body.style.overflow;
    background.forEach((element)=>{element.inert=true;element.setAttribute('aria-hidden','true')});
    modal.setAttribute('aria-hidden','false');
    updateModalState();
    document.body.style.overflow='hidden';
    releaseCitationLock=()=>{
      previous.forEach(({element,inert,aria})=>{element.inert=inert;if(aria===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',aria)});
      document.body.style.overflow=overflow;
      releaseCitationLock=null;
    };
    $('#closeCitation').focus();
  }
  function closeCitation(){
    const modal=$('#citationModal');
    if(modal.getAttribute('aria-hidden')==='true')return;
    modal.setAttribute('aria-hidden','true');
    releaseCitationLock?.();
    updateModalState();
    citationReturnFocus?.focus();
    citationReturnFocus=null;
  }
  function handleCitationKeys(event){
    const modal=$('#citationModal');
    if(modal.getAttribute('aria-hidden')==='true')return;
    if(event.key==='Escape'){event.preventDefault();closeCitation();return}
    if(event.key!=='Tab')return;
    const items=[...modal.querySelectorAll('button,[href]')].filter((element)=>!element.hidden);
    if(!items.length)return;
    const first=items[0];
    const last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
  function save(){
    if(liveCart.connected)return;
    commerce().writeCart(state.cart.map((line)=>({id:line.item.id,quantity:line.quantity})));
  }
  function restore(){state.cart=commerce().readCart().map((line)=>({item:catalog().find((item)=>item.id===line.id),quantity:line.quantity})).filter((line)=>line.item)}
  function serverCartItems(payload){return Array.isArray(payload?.items)?payload.items:Array.isArray(payload?.cart?.items)?payload.cart.items:[]}
  function hydrateServerCart(payload){
    state.cart=serverCartItems(payload).map((line)=>({
      item:catalog().find((item)=>item.id===(line.productId||line.id)),
      quantity:Number(line.quantity),
      server:{unitPriceJpy:Number.isInteger(line.unitPriceJpy)?line.unitPriceJpy:null,price:line.price||null,inventory:line.inventory||null},
    })).filter((line)=>line.item&&Number.isInteger(line.quantity)&&line.quantity>0);
    save();
    renderCart();
  }
  function clearLiveCartSession({restoreAnonymous=true}={}){
    liveCart.connected=false;
    liveCart.session=null;
    liveCart.userId=null;
    state.cart=[];
    if(restoreAnonymous)restore();
    renderCart();
  }
  function liveCartError(error){
    if(error?.code==='SALE_PRICE_NOT_APPROVED')return 'この商品の販売価格を確認できないため、追加できません。';
    if(error?.code==='PRODUCT_NOT_FOUND')return '現在販売対象ではない商品です。';
    if(error?.code==='AUTHENTICATION_REQUIRED')return '会員セッションが終了しました。再度ログインしてください。';
    return '会員カートを更新できませんでした。内容は変更されていません。';
  }
  function queueLiveCartMutation(action){
    cartMutationQueue=cartMutationQueue.then(action,action);
    return cartMutationQueue;
  }
  async function synchronizeLiveCart({mergeAnonymous=false}={}){
    if(!live()?.configured)return false;
    try{
      const capabilities=liveCart.capabilities||await live().capabilities();
      liveCart.capabilities=capabilities;
      if(!live().isActivated(capabilities)){
        if(liveCart.connected)clearLiveCartSession();
        return false;
      }
      const previousUserId=liveCart.userId;
      const session=await live().session();
      const nextUserId=session.authenticated&&typeof session.user?.id==='string'?session.user.id:null;
      if(!nextUserId){
        if(previousUserId||liveCart.connected)clearLiveCartSession();
        liveCart.session=session;
        return false;
      }
      if(liveCart.connected&&previousUserId===nextUserId){
        liveCart.session=session;
        return true;
      }
      const anonymousLines=mergeAnonymous&&!previousUserId?[...state.cart]:[];
      state.cart=[];
      liveCart.connected=true;
      liveCart.session=session;
      liveCart.userId=nextUserId;
      let serverCart=await live().cart();
      if(anonymousLines.length){
        let rejected=0;
        for(const line of anonymousLines){
          const existing=serverCartItems(serverCart).find((item)=>(item.productId||item.id)===line.item.id);
          const quantity=Math.min(commerce().maxQuantity,Math.max(Number(existing?.quantity)||0,line.quantity));
          try{serverCart=await live().setCartItem(line.item.id,quantity)}catch{rejected+=1}
        }
        serverCart=await live().cart();
        commerce().writeCart([]);
        if(rejected)toast(`${rejected}件は商品情報を確認できず、カートへ移行していません。`);
      }
      hydrateServerCart(serverCart);
      return true;
    }catch{
      if(liveCart.connected)clearLiveCartSession({restoreAnonymous:false});
      return false;
    }
  }
  async function initializeLiveCart(){
    await synchronizeLiveCart({mergeAnonymous:true});
  }
  function matching(){
    const items=visibleCatalog().filter((item)=>{
      return (state.category==='all'||item.category===state.category)
        && (state.brand==='all'||item.brand===state.brand)
        && (state.device==='all'||deviceFor(item)===state.device)
        && matchesQuery(item,state.query);
    });
    const presentationOrder=(a,b)=>Number(!imageFor(a))-Number(!imageFor(b))
      ||Number(a.status==='IDENTITY_PENDING')-Number(b.status==='IDENTITY_PENDING');
    if (state.sort==='source') return items.sort((a,b)=>presentationOrder(a,b));
    const valueFor=state.sort==='name'
      ? (item)=>item.product_name_ja||item.name||''
      : (item)=>item.product_code||item.sku||'';
    return items.sort((a,b)=>presentationOrder(a,b)
      ||collator.compare(valueFor(a),valueFor(b))||collator.compare(a.id,b.id));
  }
  function renderFilters(){
    const host=$('#groupFilters');
    host.replaceChildren();
    const groupCounts=Object.fromEntries(Object.keys(groupLabels).map((group)=>[group,0]));
    const allItems=catalog();
    groupCounts.all=allItems.length;
    allItems.forEach((item)=>{groupCounts[groupFor(item.category)]++});
    Object.entries(groupLabels).forEach(([value,label])=>{
      const button=document.createElement('button');
      button.type='button';
      const count=document.createElement('span');
      count.className='filter-count';
      count.textContent=String(groupCounts[value]);
      button.append(document.createTextNode(label),count);
      button.setAttribute('aria-label',`${label} ${groupCounts[value]}件`);
      button.setAttribute('aria-pressed',String(value===state.group));
      button.addEventListener('click',()=>{state.group=value;state.category='all';state.brand='all';state.device='all';renderFilters();renderProducts()});
      host.append(button);
    });
    const groupItems=visibleCatalog();
    const categories=[...new Set(groupItems.map((item)=>item.category).filter(Boolean))];
    state.category=setOptions($('#categoryFilter'),[['all','すべての品類'],...categories.map((category)=>[category,readableCategory({category})])],state.category);
    const categoryItems=groupItems.filter((item)=>state.category==='all'||item.category===state.category);
    const brands=[...new Set(categoryItems.map((item)=>item.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
    state.brand=setOptions($('#brandFilter'),[['all','すべてのブランド'],...brands.map((brand)=>[brand,brand==='UNKNOWN'?'ブランド情報なし':brand])],state.brand);
    const brandItems=categoryItems.filter((item)=>state.brand==='all'||item.brand===state.brand);
    const devices=[...new Set(brandItems.map(deviceFor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
    const showDevice=state.group==='heated'||categoryGroups.heated.includes(state.category);
    $('#deviceFilterWrap').hidden=!showDevice||!devices.length;
    state.device=showDevice&&devices.length
      ? setOptions($('#deviceFilter'),[['all','すべての対応機種'],...devices.map((device)=>[device,device])],state.device)
      : 'all';
  }
  function renderProducts(keepVisibleCount=false){if(keepVisibleCount!==true)state.visibleCount=pageSize;const items=matching();const shownCount=Math.min(items.length,state.visibleCount);const host=$('#productGrid');host.innerHTML='';host.classList.toggle('is-single',items.length===1);$('#resultCount').textContent=`${items.length} 件中 ${shownCount} 件を表示`;const more=$('#loadMoreProducts');more.hidden=shownCount>=items.length;more.textContent=`さらに ${Math.min(pageSize,items.length-shownCount)} 件表示`;
    items.slice(0,shownCount).forEach((item)=>{
      const card=document.createElement('article');
      card.className='product-card';
      const image=imageFor(item);
      const name=customerName(item);
      const displayPrice=publicPrice(item);
      const canAdd=approvedCatalogPrice(item);
      const device=deviceFor(item);
      const specs=[item.pack_size!=null?`${item.pack_size}${item.pack_unit||'本'}`:null,item.tar_mg!=null?`Tar ${item.tar_mg}mg`:null,item.nicotine_mg!=null?`Nicotine ${item.nicotine_mg}mg`:null,device?`対応 ${device}`:null].filter(Boolean);
      const addLabel=canAdd?'カートに入れる':displayPrice.text==='オープン価格'?'価格確定後に購入可':!catalogAuthorityConfigured()?'価格未登録のため購入不可':'販売価格確認中';
      card.innerHTML=`${image?`<a class="product-image-link" href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(name)}の画像を原寸で見る"><img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async"></a>`:'<div class="product-empty">画像未登録</div>'}<div class="product-copy"><p class="product-meta">${escapeHtml(readableCategory(item))} / ${escapeHtml(customerBrand(item))}</p><h3 class="product-name">${escapeHtml(name)}</h3><p class="product-code">商品コード ${escapeHtml(item.product_code||item.sku||'未登録')}</p>${specs.length?`<p class="product-specs">${escapeHtml(specs.join(' · '))}</p>`:''}<div class="product-bottom"><div class="price">${escapeHtml(displayPrice.text)}<small>${escapeHtml(displayPrice.label)}<br>${escapeHtml(displayPrice.note)}</small></div></div><div class="product-actions"><button class="citation-button" type="button" aria-label="${escapeHtml(name)}の商品情報と出典を見る">商品情報を見る</button><button class="add-button" type="button" aria-label="${escapeHtml(name)}をカートに追加" ${canAdd?'':'disabled'}>${escapeHtml(addLabel)}</button></div></div>`;
      card.querySelector('.add-button').addEventListener('click',()=>add(item));
      card.querySelector('.citation-button').addEventListener('click',(event)=>openCitation(item,event.currentTarget));
      host.append(card);
    });
    if(!items.length)host.innerHTML='<p class="product-empty">該当する商品がありません。</p>';
  }
  function add(item){
    if(!approvedCatalogPrice(item)){toast('承認済み販売価格を確認できないため、カートへ追加できません');return}
    if(live()?.configured&&liveCart.capabilities&&live().isActivated(liveCart.capabilities))return queueLiveCartMutation(async()=>{
      if(await synchronizeLiveCart({mergeAnonymous:true})){
        const existing=state.cart.find((line)=>line.item.id===item.id);
        if((existing?.quantity||0)>=commerce().maxQuantity){toast('数量の上限は99点です');return}
        try{hydrateServerCart(await live().adjustCartItem(item.id,1));toast('会員カートに追加しました')}catch(error){toast(liveCartError(error))}
        return;
      }
      addLocal(item);
    });
    addLocal(item);
  }
  function addLocal(item){
    const existing=state.cart.find((line)=>line.item.id===item.id);if(existing){if(existing.quantity>=commerce().maxQuantity){toast('数量の上限は99点です');return}existing.quantity+=1}else{state.cart.push({item,quantity:1})}save();renderCart();toast('カートに追加しました')
  }
  function changeQuantity(itemId,delta){
    const line=state.cart.find((entry)=>entry.item.id===itemId);if(!line)return;
    if(liveCart.connected)return queueLiveCartMutation(async()=>{const expectedUserId=liveCart.userId;if(!await synchronizeLiveCart())return;if(expectedUserId!==liveCart.userId){toast('会員が切り替わったため、カートを更新しました。もう一度操作してください。');return}const current=state.cart.find((entry)=>entry.item.id===itemId);if(!current)return;if((delta<0&&current.quantity<=1)||(delta>0&&current.quantity>=commerce().maxQuantity))return;try{hydrateServerCart(await live().adjustCartItem(itemId,delta))}catch(error){toast(liveCartError(error))}});
    line.quantity=Math.min(commerce().maxQuantity,Math.max(1,line.quantity+delta));save();renderCart()
  }
  function removeFromCart(itemId){
    if(liveCart.connected)return queueLiveCartMutation(async()=>{const expectedUserId=liveCart.userId;if(!await synchronizeLiveCart())return;if(expectedUserId!==liveCart.userId){toast('会員が切り替わったため、カートを更新しました。もう一度操作してください。');return}try{hydrateServerCart(await live().removeCartItem(itemId));toast('会員カートから削除しました')}catch(error){toast(liveCartError(error))}});
    state.cart=state.cart.filter((line)=>line.item.id!==itemId);save();renderCart();toast('カートから削除しました')
  }
  function renderCart(){
    const host=$('#cartItems');
    host.replaceChildren();
    const count=state.cart.reduce((sum,line)=>sum+line.quantity,0);
    $('#cartCount').textContent=count;
    const mobileCount=$('#mobileCartCount');
    if(mobileCount)mobileCount.textContent=count;
    const startApplication=$('#startApplication');
    const cartIsEmpty=!state.cart.length;
    startApplication.classList.toggle('is-disabled',cartIsEmpty);
    if(cartIsEmpty){
      startApplication.setAttribute('aria-disabled','true');
      startApplication.setAttribute('tabindex','-1');
    }else{
      startApplication.removeAttribute('aria-disabled');
      startApplication.removeAttribute('tabindex');
    }
    $('#cartTotal').textContent=cartTotalText();
    $('#cartTotalLabel').textContent=liveCart.connected?'商品小計':'表示価格の小計';
    $('#cartStorageNote').textContent=liveCart.connected
      ? 'カート内容は会員情報に保存されています。'
      : '数量と表示小計はこの端末内に保存されます。';
    if(cartIsEmpty){
      const empty=document.createElement('p');
      empty.className='panel-note';
      empty.textContent='カートは空です。商品を追加してください。';
      host.append(empty);
      return;
    }
    state.cart.forEach((entry)=>{
      const item=entry.item;
      const name=customerName(item);
      const unitPrice=cartUnitPrice(entry);
      const localPrice=publicPrice(item);
      const unitText=liveCart.connected?(unitPrice==null?'価格情報なし':yen(unitPrice)):localPrice.text;
      const priceKind=liveCart.connected?(unitPrice==null?'価格情報なし':'販売価格'):localPrice.label;
      const line=document.createElement('div');
      line.className='cart-line';
      line.innerHTML=`<div class="cart-line-main"><p><strong>${escapeHtml(name)}</strong></p><p>${escapeHtml(item.product_code||item.sku||'')}</p><div class="quantity-control" aria-label="${escapeHtml(name)}の数量"><button class="quantity-minus" type="button" aria-label="${escapeHtml(name)}の数量を1減らす" ${entry.quantity<=1?'disabled':''}>−</button><output aria-label="${escapeHtml(name)}の数量">${entry.quantity}</output><button class="quantity-plus" type="button" aria-label="${escapeHtml(name)}の数量を1増やす" ${entry.quantity>=commerce().maxQuantity?'disabled':''}>＋</button></div><button class="remove" type="button" aria-label="${escapeHtml(name)}をカートから削除">削除</button></div><div class="cart-line-price"><small>${escapeHtml(unitText)} × ${entry.quantity} / ${escapeHtml(priceKind)}</small><strong>${linePriceText(entry)}</strong></div>`;
      line.querySelector('.quantity-minus').addEventListener('click',()=>changeQuantity(item.id,-1));
      line.querySelector('.quantity-plus').addEventListener('click',()=>changeQuantity(item.id,1));
      line.querySelector('.remove').addEventListener('click',()=>removeFromCart(item.id));
      host.append(line);
    });
  }
  let cartReturnFocus=null;
  let releaseCartLock=null;
  function cartFocusable(){return [...$('#cartPanel').querySelectorAll('button:not([disabled]),[href],input,select,textarea,[tabindex]')].filter((element)=>!element.hidden&&element.tabIndex>=0&&element.getAttribute('aria-disabled')!=='true')}
  function handleCartKeys(event){
    const panel=$('#cartPanel');
    if(panel.getAttribute('aria-hidden')==='true')return;
    if(event.key==='Escape'){event.preventDefault();closeCart();return}
    if(event.key!=='Tab')return;
    const items=cartFocusable();
    if(!items.length)return;
    const first=items[0];
    const last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
  function openCart(event){
    const panel=$('#cartPanel');
    if(panel.getAttribute('aria-hidden')==='false')return;
    cartReturnFocus=event?.currentTarget||document.activeElement;
    const backdrop=$('#backdrop');
    const background=[...document.body.children].filter((element)=>![panel,backdrop].includes(element)&&element.tagName!=='SCRIPT');
    const previous=background.map((element)=>({element,inert:element.inert,aria:element.getAttribute('aria-hidden')}));
    const overflow=document.body.style.overflow;
    background.forEach((element)=>{element.inert=true;element.setAttribute('aria-hidden','true')});
    panel.inert=false;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden','false');
    backdrop.hidden=false;
    updateModalState();
    document.body.style.overflow='hidden';
    releaseCartLock=()=>{
      previous.forEach(({element,inert,aria})=>{element.inert=inert;if(aria===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',aria)});
      document.body.style.overflow=overflow;
      releaseCartLock=null;
    };
    $('#closeCart').focus();
  }
  function closeCart(){
    const panel=$('#cartPanel');
    if(panel.getAttribute('aria-hidden')==='true')return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
    panel.inert=true;
    $('#backdrop').hidden=true;
    releaseCartLock?.();
    updateModalState();
    cartReturnFocus?.focus();
    cartReturnFocus=null;
  }
  let releaseGateLock=null;
  let ageReturnFocus=null;
  let revealCatalogOnEntry=false;
  function lockAge(){
    const earlyGate=globalThis.KISARAGI_AGE_GATE;
    if(earlyGate?.initialized){
      ageReturnFocus=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:null;
      earlyGate.lock();
      updateModalState();
      releaseGateLock=()=>{earlyGate.release({focus:false});releaseGateLock=null};
      return;
    }
    const gate=$('#ageGate');ageReturnFocus=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:null;const background=[...document.body.children].filter((element)=>element!==gate&&element.tagName!=='SCRIPT');const previous=background.map((element)=>({element,inert:element.inert,aria:element.getAttribute('aria-hidden')}));const overflow=document.body.style.overflow;background.forEach((element)=>{element.inert=true;element.setAttribute('aria-hidden','true')});updateModalState();document.body.style.overflow='hidden';const focusable=()=>[...gate.querySelectorAll('button,[href]')].filter((element)=>!element.hidden);const trap=(event)=>{if(event.key!=='Tab')return;const items=focusable();if(!items.length)return;const first=items[0];const last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};gate.addEventListener('keydown',trap);window.setTimeout(()=>focusable()[0]?.focus(),0);releaseGateLock=()=>{gate.removeEventListener('keydown',trap);previous.forEach(({element,inert,aria})=>{element.inert=inert;if(aria===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',aria)});document.body.style.overflow=overflow;releaseGateLock=null}
  }
  function releaseAge(){
    const wasLocked=Boolean(releaseGateLock);
    releaseGateLock?.();
    sessionStorage.setItem('kisaragi-age-verified','1');
    $('#ageGate').hidden=true;
    updateModalState();
    if(wasLocked){
      const target=ageReturnFocus?.isConnected?ageReturnFocus:$('#searchInput');
      target?.focus({preventScroll:true});
    }
    ageReturnFocus=null;
    if(location.hash==='#guide')requestAnimationFrame(()=>$('#guide').scrollIntoView({block:'start'}));
    else if(revealCatalogOnEntry)requestAnimationFrame(()=>$('#catalog').scrollIntoView({block:'start'}));
  }
  function applyInitialLocationFilters(){
    const params=new URLSearchParams(location.search);
    const requestedCategory=(params.get('category')||'').trim();
    if(requestedCategory){
      const normalizedCategory=requestedCategory.toLowerCase()==='other'?'rolling':requestedCategory.toLowerCase();
      if(Object.hasOwn(categoryGroups,normalizedCategory)){
        state.group=normalizedCategory;
      }else{
        const categoryCode=requestedCategory.toUpperCase();
        if(catalog().some((item)=>item.category===categoryCode)){
          state.group=groupFor(categoryCode);
          state.category=categoryCode;
        }
      }
    }
    const requestedQuery=(params.get('q')||'').trim();
    const linkedSku=(params.get('sku')||'').trim();
    const linkedProduct=linkedSku&&catalog().find((item)=>item.id===linkedSku);
    if(requestedQuery){
      state.query=requestedQuery;
    }else if(linkedProduct){
      state.group=groupFor(linkedProduct.category);
      state.query=linkedProduct.product_code||linkedProduct.sku||linkedProduct.product_name_ja;
    }
    $('#searchInput').value=state.query;
    revealCatalogOnEntry=location.hash==='#catalog'||Boolean(requestedCategory||requestedQuery||linkedProduct);
  }
  function init(){
    if(!commerce()){
      console.error('KISARAGI commerce configuration failed to load');
      return;
    }
    restore();
    applyInitialLocationFilters();
    renderFilters();
    renderProducts();
    renderCart();
    initializeLiveCart();
    window.addEventListener('focus',()=>{void queueLiveCartMutation(()=>synchronizeLiveCart({mergeAnonymous:true}))});
    window.addEventListener('pageshow',()=>{void queueLiveCartMutation(()=>synchronizeLiveCart({mergeAnonymous:true}))});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void queueLiveCartMutation(()=>synchronizeLiveCart({mergeAnonymous:true}))});
    window.addEventListener('storage',(event)=>{if(event.key===live()?.sessionRevisionKey)void queueLiveCartMutation(()=>synchronizeLiveCart({mergeAnonymous:true}))});
    $('#searchInput').addEventListener('input',(event)=>{state.query=event.target.value;renderProducts()});
    $('#toggleAdvancedFilters').addEventListener('click',(event)=>{const filters=event.currentTarget.closest('.filters');const open=!filters.classList.contains('is-advanced-open');filters.classList.toggle('is-advanced-open',open);event.currentTarget.setAttribute('aria-expanded',String(open))});
    $('#categoryFilter').addEventListener('change',(event)=>{state.category=event.target.value;state.brand='all';state.device='all';renderFilters();renderProducts()});
    $('#brandFilter').addEventListener('change',(event)=>{state.brand=event.target.value;state.device='all';renderFilters();renderProducts()});
    $('#deviceFilter').addEventListener('change',(event)=>{state.device=event.target.value;renderProducts()});
    $('#sortOrder').addEventListener('change',(event)=>{state.sort=event.target.value;renderProducts()});
    $('#resetFilters').addEventListener('click',()=>{state.group='all';state.category='all';state.brand='all';state.device='all';state.sort='source';state.query='';$('#searchInput').value='';$('#sortOrder').value='source';renderFilters();renderProducts();$('#searchInput').focus()});
    $('#loadMoreProducts').addEventListener('click',()=>{state.visibleCount+=pageSize;renderProducts(true)});
    $('#openCart').addEventListener('click',openCart);
    const mobileCartButton=$('#mobileOpenCart');
    if(mobileCartButton)mobileCartButton.addEventListener('click',openCart);
    $('#closeCart').addEventListener('click',closeCart);
    $('#backdrop').addEventListener('click',closeCart);
    $('#startApplication').addEventListener('click',(event)=>{if(!state.cart.length){event.preventDefault();toast('商品をカートに追加してから確認してください')}});
    $('#closeCitation').addEventListener('click',closeCitation);
    $('#citationModal').addEventListener('click',(event)=>{if(event.target===$('#citationModal'))closeCitation()});
    document.addEventListener('keydown',handleCitationKeys);
    document.addEventListener('keydown',handleCartKeys);
    $('#enterSite').addEventListener('click',releaseAge);
    window.addEventListener('kisaragi-catalog-updated',()=>{state.cart=state.cart.map((line)=>({...line,item:catalog().find((item)=>item.id===line.item.id)})).filter((line)=>line.item);renderFilters();renderProducts(true);renderCart()});
    if(sessionStorage.getItem('kisaragi-age-verified')==='1')releaseAge();
    else lockAge();
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
