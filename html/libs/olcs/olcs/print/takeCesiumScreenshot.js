/**
 */
export function takeScreenshot(scene, options) {
    return new Promise((resolve, reject) => {
        // preserveDrawingBuffers is false so we render on demand and immediately read the buffer
        const remover = scene.postRender.addEventListener(() => {
            remover();
            try {
                let url;
                if (options) {
                    const smallerCanvas = document.createElement('canvas');
                    smallerCanvas.width = options.width;
                    smallerCanvas.height = options.height;
                    smallerCanvas.getContext('2d').drawImage(scene.canvas, options.offsetX, options.offsetY, options.width, options.height, 0, 0, options.width, options.height);
                    url = smallerCanvas.toDataURL();
                }
                else {
                    url = scene.canvas.toDataURL();
                }
                resolve(url);
            }
            catch (e) {
                reject(e);
            }
        });
        scene.requestRender();
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFrZUNlc2l1bVNjcmVlbnNob3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvb2xjcy9wcmludC90YWtlQ2VzaXVtU2NyZWVuc2hvdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFTQTtHQUNHO0FBQ0gsTUFBTSxVQUFVLGNBQWMsQ0FBQyxLQUFZLEVBQUUsT0FBMEI7SUFDckUsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUN2Qyx5RkFBeUY7UUFDdkYsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUU7WUFDckQsT0FBTyxFQUFFLENBQUM7WUFDVixJQUFJLENBQUM7Z0JBQ0gsSUFBSSxHQUFHLENBQUM7Z0JBRVIsSUFBSSxPQUFPLEVBQUUsQ0FBQztvQkFDWixNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUV2RCxhQUFhLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7b0JBQ3BDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztvQkFDdEMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQ3BDLEtBQUssQ0FBQyxNQUFNLEVBQ1osT0FBTyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFDL0QsQ0FBQyxFQUFFLENBQUMsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDekMsR0FBRyxHQUFHLGFBQWEsQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDbEMsQ0FBQztxQkFDSSxDQUFDO29CQUNKLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNqQyxDQUFDO2dCQUNELE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNmLENBQUM7WUFDRCxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNULE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNaLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILEtBQUssQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN4QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMifQ==