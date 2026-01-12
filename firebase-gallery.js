// ============================================
// FUNCIONES PARA FIREBASE (SOLO FIRESTORE)
// ============================================

// Cargar galería desde Firebase
async function getGalleryDataFromFirebase() {
    try {
        console.log('📥 Cargando galería desde Firebase...');
        const snapshot = await db.collection('photos').get();
        
        if (snapshot.empty) {
            console.log('📭 Base de datos vacía.  Subiendo galería original...');
            await saveGalleryDataToFirebase(originalGalleryData);
            return JSON.parse(JSON.stringify(originalGalleryData));
        }
        
        const data = {};
        snapshot.forEach(doc => {
            data[doc.id] = doc.data().photos || [];
        });
        
        console. log('✅ Galería cargada:', Object.keys(data).length, 'países');
        return data;
    } catch (error) {
        console.error('❌ Error al cargar galería:', error);
        showToast('Error al cargar desde Firebase', 'error');
        return JSON.parse(JSON.stringify(originalGalleryData));
    }
}

// Guardar galería en Firebase
async function saveGalleryDataToFirebase(data) {
    try {
        console.log('💾 Guardando en Firebase...');
        const batch = db.batch();
        
        Object.keys(data).forEach(country => {
            const docRef = db.collection('photos').doc(country);
            batch.set(docRef, { photos: data[country] }, { merge: true });
        });
        
        await batch.commit();
        console.log('✅ Guardado exitoso');
        return true;
    } catch (error) {
        console.error('❌ Error al guardar:', error);
        showToast('Error al guardar en Firebase', 'error');
        return false;
    }
}

// Comprimir imagen para no exceder límite de Firestore
function compressImage(file, maxSizeKB = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Reducir dimensiones si es muy grande
                const maxDimension = 1200;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx. drawImage(img, 0, 0, width, height);
                
                // Comprimir con calidad ajustable
                let quality = 0.7;
                let result = canvas.toDataURL('image/jpeg', quality);
                
                // Reducir calidad si aún es muy grande
                while (result.length / 1024 > maxSizeKB && quality > 0.1) {
                    quality -= 0.1;
                    result = canvas.toDataURL('image/jpeg', quality);
                }
                
                const finalSizeKB = (result.length / 1024).toFixed(0);
                console.log(`🖼️ Imagen comprimida: ${finalSizeKB}KB (calidad: ${(quality * 100).toFixed(0)}%)`);
                resolve(result);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader. onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================
// ACTUALIZAR BASE DE DATOS CON NUEVOS PAÍSES
// ============================================
async function updateFirebaseWithNewCountries() {
    try {
        const currentData = await getGalleryDataFromFirebase();
        
        // 🔧 CORREGIDO: Verificar TODOS los países en originalGalleryData
        const allCountries = Object.keys(originalGalleryData);
        
        let needsUpdate = false;
        allCountries.forEach(country => {
            if (!currentData[country]) {
                console.log(`➕ Agregando país nuevo: ${country}`);
                currentData[country] = originalGalleryData[country];
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            console.log('🔄 Actualizando Firebase con nuevos países...');
            await saveGalleryDataToFirebase(currentData);
            console.log(`✅ Firebase actualizado con ${allCountries.length} países`);
            return true;
        } else {
            console.log(`✅ Firebase ya tiene todos los ${allCountries.length} países`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error al actualizar:', error);
        return false;
    }
}

// Ejecutar actualización al cargar la página (solo una vez)
(async function checkAndUpdate() {
    const updated = await updateFirebaseWithNewCountries();
    if (updated) {
        showToast('✅ Base de datos actualizada con nuevos países', 'success');
        setTimeout(() => location.reload(), 2000);
    }
})();
