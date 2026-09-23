(() => {
  const $ = (selector) => document.querySelector(selector);
  const pageSize = 24;
  const state = {mode:'shop', group:'all', category:'all', brand:'all', device:'all', sort:'source', query:'', cart:[], visibleCount:pageSize};
  const commerce = () => globalThis.KISARAGI_COMMERCE;
  const live = () => globalThis.KISARAGI_COMMERCE_LIVE;
  const liveCart = {connected:false, capabilities:null, session:null};
  let cartMutationQueue = Promise.resolve();
  const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const currentPrice = (item) => item.price_jpy ?? item.price ?? null;
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
  const officialPriceStatus = (item) => item.official_catalog_price_verification || item.official_catalog_price_extraction_status || null;
  const officialPricePeriod = (item) => [
    item.official_catalog_price_valid_from || item.official_catalog_price_effective_from,
    item.official_catalog_price_valid_until || item.official_catalog_price_effective_to,
  ].filter(Boolean).join(' ～ ');
  const officialPriceStatusLabel = (item) => ({
    SOURCE_VERIFIED:'資料原文確認済み', SOURCE_REVIEWED:'資料原文確認済み', SOURCE_EXTRACTED:'資料原文抽出済み', SOURCE_TEXT:'資料原文抽出済み',
    OCR_REVIEWED:'OCR確認済み', OCR_EXTRACTED:'公式PDFからOCR抽出済み', OCR_REVIEW_REQUIRED:'OCR確認待ち',
  })[String(officialPriceStatus(item) || '').toUpperCase()] || officialPriceStatus(item) || '未登録';
  const publicPrice = (item) => {
    const adminAmount = currentPrice(item);
    if (adminAmount != null) return {amount:Number(adminAmount), text:yen(adminAmount), label:'管理者設定の表示価格', note:'注文時は承認済み販売価格をサーバーで再確認します'};
    const official = officialPrice(item);
    const tax = item.official_catalog_price_tax_included === true ? '税込' : item.official_catalog_price_tax_included === false ? '税別' : '税区分記載なし';
    const extractionStatus = String(officialPriceStatus(item) || '').toUpperCase();
    const sourceNote = extractionStatus === 'OCR_EXTRACTED'
      ? '・公式PDF OCR抽出' : /OCR_REVIEW_REQUIRED|PENDING/.test(extractionStatus) ? '・OCR確認待ち' : '';
    const date = item.official_catalog_price_as_of || officialPricePeriod(item);
    if (official.amount != null) return {amount:official.amount, text:yen(official.amount), label:`${official.kindLabel}（${tax}${sourceNote}）`, note:`${date ? `${date} / ` : ''}参考情報・承認済み販売価格ではありません`};
    if (official.open) return {amount:null, text:'オープン価格', label:`${official.kindLabel}${sourceNote ? `（${sourceNote.slice(1)}）` : ''}`, note:'販売価格は事業者確認・承認後に確定します'};
    return {amount:null, text:'価格未登録', label:'販売価格未承認', note:'注文に使用できる価格は登録されていません'};
  };
  const cartUnitPrice = (line) => line.server
    ? (Number.isInteger(line.server.unitPriceJpy) ? line.server.unitPriceJpy : null)
    : publicPrice(line.item).amount;
  const linePriceText = (line) => cartUnitPrice(line) == null ? '価格確認中' : yen(cartUnitPrice(line) * line.quantity);
  const cartTotalText = () => {
    const knownTotal = state.cart.reduce((sum, line) => sum + ((cartUnitPrice(line) ?? 0) * line.quantity), 0);
    return state.cart.some((line) => cartUnitPrice(line) == null)
      ? `${knownTotal ? `確認済み分 ${yen(knownTotal)} + ` : ''}価格確認中`
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
  const categoryGroups = {
    cigarettes: ['CIGARETTES', 'IMPORTED_CIGARETTES'],
    heated: ['HEATED_TOBACCO_STICKS', 'HEATED_TOBACCO_CAPSULES', 'HEATED_TOBACCO_DEVICES'],
    other: ['CIGARS', 'RYO', 'PIPE_TOBACCO', 'CUT_TOBACCO', 'SMOKELESS_TOBACCO'],
    goods: ['SMOKING_ACCESSORIES', 'ROLLING_ACCESSORIES', 'PIPE_ACCESSORIES', 'ASHTRAYS', 'LIGHTERS'],
  };
  const groupLabels = {all:'すべて', cigarettes:'紙巻き', heated:'加熱式', other:'その他たばこ', goods:'喫煙具'};
  const groupFor = (category) => Object.keys(categoryGroups).find((group) => categoryGroups[group].includes(category)) || 'other';
  const normalize = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g, '');
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
  function setMode(mode, announce=false){
    if(!['shop','archive'].includes(mode))return;
    state.mode=mode;
    document.body.dataset.kisaragiMode=mode;
    document.querySelectorAll('[data-mode-target]').forEach((button)=>{
      const active=button.dataset.modeTarget===mode;
      button.setAttribute('aria-pressed',String(active));
    });
    window.dispatchEvent(new CustomEvent('kisaragi-mode-changed',{detail:{mode}}));
    if(announce)toast(mode==='archive'?'資料モードに切り替えました':'商品モードに切り替えました');
  }
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
  function citationStatus(item){
    if(item.status==='IDENTITY_PENDING')return '資料転記・現行未確認';
    if(item.status==='CATALOG_ONLY')return '資料登録済み・画像未登録';
    if(item.status==='IMAGE_BOUND')return '資料登録済み・画像紐付け済み';
    return item.status||'資料登録済み';
  }
  function usageStatus(item){
    const value=item.usage_status??item.usageStatus??item.publication_status??item.publicationStatus;
    if(value!=null&&value!=='')return String(value);
    if(typeof item.publicationAllowed==='boolean')return item.publicationAllowed?'掲載可':'掲載不可';
    return '未登録';
  }
  function licenseStatus(item,source){
    const value=item.license??item.license_status??item.licenseStatus??item.image_license??item.image?.license??source?.license??source?.image_permission_basis;
    return value==null||value===''?'未登録':String(value);
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
    $('#citationTitle').textContent=item.product_name_ja||item.name||'商品資料';
    const body=$('#citationBody');
    body.replaceChildren(
      citationRow('品類',readableCategory(item)),
      citationRow('商品コード',item.product_code||item.sku||'未登録'),
      citationRow('資料状態',citationStatus(item)),
      citationRow('資料確認日',item.source_checked_at||'未登録'),
      citationRow('資料区分',sourceId(source)||item.subcategory||'商品資料'),
      citationRow('公式カタログ価格',officialPriceText),
      citationRow('価格区分',`${official.kindLabel} / ${taxLabel}`),
      citationRow('価格基準日',item.official_catalog_price_as_of||'未登録'),
      citationRow('価格有効期間',validity||'未登録'),
      citationRow('価格資料',item.official_catalog_price_source_id||'未登録'),
      citationRow('価格掲載ページ',evidencePage??'未登録'),
      citationRow('価格根拠資料',evidenceSummary||'未登録'),
      citationRow('価格確認状態',officialPriceStatusLabel(item)),
      citationRow('画像出典',item.image_source||'画像未登録'),
      citationRow('利用状態',usageStatus(item)),
      citationRow('ライセンス・許諾根拠',licenseStatus(item,source))
    );
    if(evidenceList.length>1)body.append(citationRow('価格根拠件数',`${evidenceList.length}件（新しい基準日を優先表示）`));
    if(evidenceText)body.append(citationRow('価格根拠',evidenceText));
    body.append(citationRow('販売価格との関係','公式カタログ価格は参考情報です。承認済み販売価格ではありません。'));
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
  function save(){commerce().writeCart(state.cart.map((line)=>({id:line.item.id,quantity:line.quantity})))}
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
  function liveCartError(error){
    if(error?.code==='SALE_PRICE_NOT_APPROVED')return '承認済み販売価格がないため、会員カートへ追加できません。';
    if(error?.code==='PRODUCT_NOT_FOUND')return '現在販売対象ではない商品です。';
    if(error?.code==='AUTHENTICATION_REQUIRED')return '会員セッションが終了しました。再度ログインしてください。';
    return '会員カートを更新できませんでした。内容は変更されていません。';
  }
  function queueLiveCartMutation(action){
    cartMutationQueue=cartMutationQueue.then(action,action);
    return cartMutationQueue;
  }
  async function initializeLiveCart(){
    if(!live()?.configured)return;
    try{
      const capabilities=await live().capabilities();
      if(!live().isActivated(capabilities))return;
      const session=await live().session();
      if(!session.authenticated)return;
      liveCart.connected=true;
      liveCart.capabilities=capabilities;
      liveCart.session=session;
      let serverCart=await live().cart();
      if(!serverCartItems(serverCart).length&&state.cart.length){
        let rejected=0;
        for(const line of [...state.cart]){
          try{serverCart=await live().setCartItem(line.item.id,line.quantity)}catch{rejected+=1}
        }
        serverCart=await live().cart();
        if(rejected)toast(`${rejected}件は販売価格または販売可否を確認できず、会員カートへ移行していません。`);
      }
      hydrateServerCart(serverCart);
    }catch{
      liveCart.connected=false;
    }
  }
  function matching(){
    const query=normalize(state.query);
    const items=visibleCatalog().filter((item)=>{
      const text=normalize([item.brand,item.product_name_ja,item.sku,item.product_code,item.system_code].filter(Boolean).join(' '));
      return (state.category==='all'||item.category===state.category)
        && (state.brand==='all'||item.brand===state.brand)
        && (state.device==='all'||deviceFor(item)===state.device)
        && (!query||text.includes(query));
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
    state.brand=setOptions($('#brandFilter'),[['all','すべてのブランド'],...brands.map((brand)=>[brand,brand==='UNKNOWN'?'ブランド未登録':brand])],state.brand);
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
      const name=item.product_name_ja||item.name||'商品名未登録';
      const displayPrice=publicPrice(item);
      const device=deviceFor(item);
      const specs=[item.pack_size!=null?`${item.pack_size}${item.pack_unit||'本'}`:null,item.tar_mg!=null?`Tar ${item.tar_mg}mg`:null,item.nicotine_mg!=null?`Nicotine ${item.nicotine_mg}mg`:null,device?`対応 ${device}`:null].filter(Boolean);
      const detailUrl=`./index.html?sku=${encodeURIComponent(item.id)}#jp-sku-catalog`;
      card.innerHTML=`${image?`<a class="product-image-link" href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(name)}の画像を原寸で見る"><img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async"></a>`:'<div class="product-empty">画像未登録</div>'}<div class="product-copy"><p class="product-meta">${escapeHtml(readableCategory(item))} / ${escapeHtml(item.brand==='UNKNOWN'?'ブランド未登録':item.brand||'ブランド未登録')}</p><h3 class="product-name">${escapeHtml(name)}</h3><p class="product-code">商品コード ${escapeHtml(item.product_code||item.sku||'未登録')}</p>${specs.length?`<p class="product-specs">${escapeHtml(specs.join(' · '))}</p>`:''}${item.status==='IDENTITY_PENDING'?'<p class="product-status">商品名は資料転記・照合待ち</p>':''}<div class="product-bottom"><div class="price">${escapeHtml(displayPrice.text)}<small>${escapeHtml(displayPrice.label)}<br>${escapeHtml(displayPrice.note)}</small></div></div><div class="product-actions"><a class="product-detail-link" href="${escapeHtml(detailUrl)}" aria-label="${escapeHtml(name)}の詳細を資料庫で見る">資料庫で詳細を見る</a><button class="citation-button" type="button" aria-label="${escapeHtml(name)}の出典を見る">出典を見る</button><button class="add-button" type="button" aria-label="${escapeHtml(name)}を選択リストに追加">選択リストに追加</button></div></div>`;
      card.querySelector('.add-button').addEventListener('click',()=>add(item));
      card.querySelector('.citation-button').addEventListener('click',(event)=>openCitation(item,event.currentTarget));
      host.append(card);
    });
    if(!items.length)host.innerHTML='<p class="product-empty">該当する商品がありません。</p>';
  }
  function add(item){
    if(state.mode==='archive'){
      toast('アーカイブ制限：資料モードでは商品を選択リストに追加できません。');
      return;
    }
    if(liveCart.connected)return queueLiveCartMutation(async()=>{
      const existing=state.cart.find((line)=>line.item.id===item.id);
      const quantity=(existing?.quantity||0)+1;
      if(quantity>commerce().maxQuantity){toast('数量の上限は99点です');return}
      try{hydrateServerCart(await live().setCartItem(item.id,quantity));toast('会員カートに追加しました')}catch(error){toast(liveCartError(error))}
    });
    const existing=state.cart.find((line)=>line.item.id===item.id);if(existing){if(existing.quantity>=commerce().maxQuantity){toast('数量の上限は99点です');return}existing.quantity+=1}else{state.cart.push({item,quantity:1})}save();renderCart();toast('選択リストに追加しました')
  }
  function changeQuantity(itemId,delta){
    const line=state.cart.find((entry)=>entry.item.id===itemId);if(!line)return;
    if(liveCart.connected)return queueLiveCartMutation(async()=>{const current=state.cart.find((entry)=>entry.item.id===itemId);if(!current)return;const quantity=Math.min(commerce().maxQuantity,Math.max(1,current.quantity+delta));try{hydrateServerCart(await live().setCartItem(itemId,quantity))}catch(error){toast(liveCartError(error))}});
    line.quantity=Math.min(commerce().maxQuantity,Math.max(1,line.quantity+delta));save();renderCart()
  }
  function removeFromCart(itemId){
    if(liveCart.connected)return queueLiveCartMutation(async()=>{try{hydrateServerCart(await live().removeCartItem(itemId));toast('会員カートから削除しました')}catch(error){toast(liveCartError(error))}});
    state.cart=state.cart.filter((line)=>line.item.id!==itemId);save();renderCart();toast('選択リストから削除しました')
  }
  function renderCart(){const host=$('#cartItems');host.replaceChildren();const count=state.cart.reduce((sum,line)=>sum+line.quantity,0);$('#cartCount').textContent=count;const mobileCount=$('#mobileCartCount');if(mobileCount)mobileCount.textContent=count;const startApplication=$('#startApplication');const cartIsEmpty=!state.cart.length;startApplication.classList.toggle('is-disabled',cartIsEmpty);if(cartIsEmpty){startApplication.setAttribute('aria-disabled','true');startApplication.setAttribute('tabindex','-1')}else{startApplication.removeAttribute('aria-disabled');startApplication.removeAttribute('tabindex')}$('#cartTotal').textContent=cartTotalText();$('#cartTotalLabel').textContent=liveCart.connected?'商品小計（承認済み販売価格）':'参考小計（注文価格ではありません）';$('#cartStorageNote').textContent=liveCart.connected?'数量と承認済み販売価格は保護された会員カートに保存されています。注文確定にはeKYC・決済・配送の本番接続が必要です。':'管理者設定の表示価格または公式カタログ価格で計算した参考小計です。現在の販売価格・承認済み注文価格ではなく、数量とともにこの端末内だけに保存します。';if(cartIsEmpty){const empty=document.createElement('p');empty.className='panel-note';empty.textContent=liveCart.connected?'会員カートは空です。商品を追加してください。':'選択リストは空です。商品を追加してください。';host.append(empty);return}state.cart.forEach((entry)=>{const item=entry.item;const name=item.product_name_ja||item.name||'商品名未登録';const unitPrice=cartUnitPrice(entry);const localPrice=publicPrice(item);const unitText=liveCart.connected?(unitPrice==null?'販売価格未承認':yen(unitPrice)):localPrice.text;const priceKind=liveCart.connected?(unitPrice==null?'承認済み販売価格なし':'承認済み販売価格'):`${localPrice.label}（注文価格ではありません）`;const line=document.createElement('div');line.className='cart-line';line.innerHTML=`<div class="cart-line-main"><p><strong>${escapeHtml(name)}</strong></p><p>${escapeHtml(item.product_code||item.sku||'')}</p><div class="quantity-control" aria-label="${escapeHtml(name)}の数量"><button class="quantity-minus" type="button" aria-label="${escapeHtml(name)}の数量を1減らす" ${entry.quantity<=1?'disabled':''}>−</button><output aria-label="${escapeHtml(name)}の数量">${entry.quantity}</output><button class="quantity-plus" type="button" aria-label="${escapeHtml(name)}の数量を1増やす" ${entry.quantity>=commerce().maxQuantity?'disabled':''}>＋</button></div><button class="remove" type="button" aria-label="${escapeHtml(name)}を選択リストから削除">削除</button></div><div class="cart-line-price"><small>${escapeHtml(unitText)} × ${entry.quantity} / ${escapeHtml(priceKind)}</small><strong>${linePriceText(entry)}</strong></div>`;line.querySelector('.quantity-minus').addEventListener('click',()=>changeQuantity(item.id,-1));line.querySelector('.quantity-plus').addEventListener('click',()=>changeQuantity(item.id,1));line.querySelector('.remove').addEventListener('click',()=>removeFromCart(item.id));host.append(line)})}
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
  function lockAge(){const gate=$('#ageGate');ageReturnFocus=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:null;const background=[...document.body.children].filter((element)=>element!==gate&&element.tagName!=='SCRIPT');const previous=background.map((element)=>({element,inert:element.inert,aria:element.getAttribute('aria-hidden')}));const overflow=document.body.style.overflow;background.forEach((element)=>{element.inert=true;element.setAttribute('aria-hidden','true')});updateModalState();document.body.style.overflow='hidden';const focusable=()=>[...gate.querySelectorAll('button,[href]')].filter((element)=>!element.hidden);const trap=(event)=>{if(event.key!=='Tab')return;const items=focusable();if(!items.length)return;const first=items[0];const last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};gate.addEventListener('keydown',trap);window.setTimeout(()=>focusable()[0]?.focus(),0);releaseGateLock=()=>{gate.removeEventListener('keydown',trap);previous.forEach(({element,inert,aria})=>{element.inert=inert;if(aria===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',aria)});document.body.style.overflow=overflow;releaseGateLock=null}}
  function releaseAge(){const wasLocked=Boolean(releaseGateLock);releaseGateLock?.();sessionStorage.setItem('kisaragi-age-verified','1');$('#ageGate').hidden=true;updateModalState();if(wasLocked){const target=ageReturnFocus?.isConnected?ageReturnFocus:$('.hero-actions .button.primary');target?.focus({preventScroll:true})}ageReturnFocus=null;if(location.hash==='#guide')requestAnimationFrame(()=>$('#guide').scrollIntoView({block:'start'}))}
  function init(){if(!commerce()){console.error('KISARAGI commerce configuration failed to load');return}restore();setMode('shop');const linkedSku=new URLSearchParams(location.search).get('sku');const linkedProduct=linkedSku&&catalog().find((item)=>item.id===linkedSku);if(linkedProduct){state.group=groupFor(linkedProduct.category);state.query=linkedProduct.product_code||linkedProduct.sku||linkedProduct.product_name_ja;$('#searchInput').value=state.query}renderFilters();renderProducts();renderCart();initializeLiveCart();document.querySelectorAll('[data-mode-target]').forEach((button)=>button.addEventListener('click',()=>setMode(button.dataset.modeTarget,true)));$('#searchInput').addEventListener('input',(event)=>{state.query=event.target.value;renderProducts()});$('#categoryFilter').addEventListener('change',(event)=>{state.category=event.target.value;state.brand='all';state.device='all';renderFilters();renderProducts()});$('#brandFilter').addEventListener('change',(event)=>{state.brand=event.target.value;state.device='all';renderFilters();renderProducts()});$('#deviceFilter').addEventListener('change',(event)=>{state.device=event.target.value;renderProducts()});$('#sortOrder').addEventListener('change',(event)=>{state.sort=event.target.value;renderProducts()});$('#resetFilters').addEventListener('click',()=>{state.group='all';state.category='all';state.brand='all';state.device='all';state.sort='source';state.query='';$('#searchInput').value='';$('#sortOrder').value='source';renderFilters();renderProducts();$('#searchInput').focus()});$('#loadMoreProducts').addEventListener('click',()=>{state.visibleCount+=pageSize;renderProducts(true)});$('#openCart').addEventListener('click',openCart);const mobileCartButton=$('#mobileOpenCart');if(mobileCartButton)mobileCartButton.addEventListener('click',openCart);$('#closeCart').addEventListener('click',closeCart);$('#backdrop').addEventListener('click',closeCart);$('#startApplication').addEventListener('click',(event)=>{if(!state.cart.length){event.preventDefault();toast('商品を選択リストに追加してから確認してください')}});$('#closeCitation').addEventListener('click',closeCitation);$('#citationModal').addEventListener('click',(event)=>{if(event.target===$('#citationModal'))closeCitation()});document.addEventListener('keydown',handleCitationKeys);document.addEventListener('keydown',handleCartKeys);$('#enterSite').addEventListener('click',releaseAge);if(sessionStorage.getItem('kisaragi-age-verified')==='1')releaseAge();else lockAge()}
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
