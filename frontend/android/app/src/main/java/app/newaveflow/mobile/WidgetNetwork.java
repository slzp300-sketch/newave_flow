package app.newaveflow.mobile;
import android.content.Context;
import org.json.JSONObject;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

final class WidgetNetwork {
    static boolean validBase(String base) {
        try { URI u=new URI(base);return "https".equals(u.getScheme())&&u.getHost()!=null&&u.getHost().endsWith(".up.railway.app")
            &&u.getPort()==-1&&u.getUserInfo()==null&&u.getQuery()==null&&u.getFragment()==null&&"/api".equals(u.getPath()); }
        catch(Exception error){return false;}
    }
    static void fetch(Context context,JSONObject input) {
        fetch(context,input,null);
    }
    static void fetch(Context context,JSONObject input,String expectedScope) {
        JSONObject session=null;String token=null;HttpURLConnection connection=null;
        try {
            session=WidgetStore.read(context);if(session==null)return;
            if(input!=null&&(expectedScope==null||!expectedScope.equals(session.optString("scope"))))return;
            token=session.getString("token");String base=session.getString("baseURL");
            if(!validBase(base))throw new IOException("Invalid endpoint");
            connection=(HttpURLConnection)new URL(base+(input==null?"/widgets/snapshot":"/widgets/check")).openConnection();
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(2500);connection.setReadTimeout(4500);
            connection.setRequestProperty("X-Newave-Widget",token);connection.setRequestProperty("Accept","application/json");
            connection.setUseCaches(false);
            if(input!=null){connection.setRequestMethod("PUT");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
                try(OutputStream out=connection.getOutputStream()){out.write(input.toString().getBytes(StandardCharsets.UTF_8));}}
            int status=connection.getResponseCode();
            if(status==401||status==403||status==428){WidgetStore.replace(context,token,null);return;}
            if(status!=200)throw new IOException("Widget request failed");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream in=connection.getInputStream()){byte[] buffer=new byte[4096];int n;
                while((n=in.read(buffer))!=-1){if(bytes.size()+n>100000)throw new IOException("Response too large");bytes.write(buffer,0,n);}}
            JSONObject snapshot=new JSONObject(bytes.toString("UTF-8"));if(snapshot.optInt("schemaVersion")!=1)throw new IOException("Unknown widget format");
            session.put("snapshot",snapshot);session.remove("error");
            if(input!=null)session.put("lastCheckAt",snapshot.getString("generatedAt"));
            WidgetStore.replace(context,token,session);
        }catch(Exception error){
            if(session!=null&&token!=null)try{session.put("error",input==null?"연결 확인 필요":"저장 확인 필요 · 앱 열기");WidgetStore.replace(context,token,session);}catch(Exception ignored){}
        }finally{if(connection!=null)connection.disconnect();NewaveWidgetProvider.renderAll(context);}
    }
}
