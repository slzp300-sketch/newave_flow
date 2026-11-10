package app.newaveflow.mobile;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name="NewaveWidgets")
public class NewaveWidgetPlugin extends Plugin {
    static JSObject state(android.content.Context context)throws Exception{
        JSONObject session=WidgetStore.read(context);JSObject result=new JSObject();result.put("connected",session!=null);
        if(session!=null){result.put("scope",session.optString("scope"));result.put("expiresAt",session.optString("expiresAt"));result.put("lastCheckAt",session.optString("lastCheckAt"));result.put("error",session.optString("error"));}
        return result;
    }
    @PluginMethod public void configure(PluginCall call){try{
        JSONObject session=new JSONObject(call.getString("session",""));
        if(!WidgetNetwork.validBase(session.getString("baseURL"))||session.getString("token").length()>4096||session.getString("token").isEmpty()
            ||session.getJSONObject("snapshot").optInt("schemaVersion")!=1)throw new IllegalArgumentException();
        WidgetStore.write(getContext(),session);NewaveWidgetProvider.renderAll(getContext());call.resolve(state(getContext()));
    }catch(Exception error){call.reject("Unable to configure widget");}}
    @PluginMethod public void clear(PluginCall call){try{WidgetStore.clear(getContext());NewaveWidgetProvider.renderAll(getContext());call.resolve(state(getContext()));}
        catch(Exception error){call.reject("Unable to clear widget");}}
    @PluginMethod public void getState(PluginCall call){try{call.resolve(state(getContext()));}catch(Exception error){call.reject("Unable to read widget");}}
    @PluginMethod public void refresh(PluginCall call){var executor=java.util.concurrent.Executors.newSingleThreadExecutor();executor.execute(()->{try{WidgetNetwork.fetch(getContext(),null);call.resolve(state(getContext()));}catch(Exception error){call.reject("Unable to refresh widget");}finally{executor.shutdown();}});}
    @PluginMethod public void pin(PluginCall call){
        AppWidgetManager manager=AppWidgetManager.getInstance(getContext());
        boolean supported=Build.VERSION.SDK_INT>=26&&manager.isRequestPinAppWidgetSupported();
        if(supported)manager.requestPinAppWidget(new ComponentName(getContext(),NewaveWidgetProvider.class),null,null);
        JSObject result=new JSObject();result.put("supported",supported);call.resolve(result);
    }
}
